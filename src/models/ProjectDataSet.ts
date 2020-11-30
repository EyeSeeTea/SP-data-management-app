import moment, { Moment } from "moment";
import _ from "lodash";
import { Id, D2Api, D2DataInputPeriod } from "../types/d2-api";
import { Config } from "./Config";
import Project, { OrganisationUnit, DataSet, DataSetType } from "./Project";
import ProjectDb, { DataSetOpenAttributes } from "./ProjectDb";
import { toISOString } from "../utils/date";

const monthFormat = "YYYYMM";

export interface DataSetOpenInfo {
    isOpen: boolean;
    isReopened: boolean;
    isOpenByDates: boolean;
    isOpenByData: boolean;
}

type DataApprovalCategoryOptionCombosParams = {
    ds: Id;
    pe: string;
    ou: Id;
};

type Level = {} | { level: string; id: string };

type DataApprovalCategoryOptionCombosResponse = CategoryOptionComboDataApproval[];

interface CategoryOptionComboDataApproval {
    level: Level;
    ou: string;
    permissions: {
        mayApprove: boolean;
        mayUnapprove: boolean;
        mayAccept: boolean;
        mayUnaccept: boolean;
        mayReadData: boolean;
    };
    accepted: boolean;
    id: string;
    ouName: string;
}

export default class ProjectDataSet {
    api: D2Api;
    config: Config;
    dataSet: DataSet | null;

    constructor(private project: Project, private dataSetType: DataSetType) {
        const { api, config } = project;
        this.api = api;
        this.config = config;
        this.dataSet = project.dataSets ? project.dataSets[dataSetType] : null;
    }

    getDataSet(): DataSet {
        if (!this.dataSet) throw new Error("No dataset");
        return this.dataSet;
    }

    getOrgUnit(): OrganisationUnit {
        if (!this.project.orgUnit) throw new Error("No org unit");
        return this.project.orgUnit;
    }

    async reopen(options: { unapprovePeriod?: string } = {}): Promise<Project> {
        const { unapprovePeriod } = options;
        const dataSet = this.getDataSet();
        const { endDate } = this.project.getDates();
        const now = moment();
        const projectDb = new ProjectDb(this.project);
        const normalAttributes = this.getDefaultOpenAttributes();
        const openAttributes: DataSetOpenAttributes = {
            dataInputPeriods: normalAttributes.dataInputPeriods.map(expandDataInputPeriod),
            openFuturePeriods: Math.max(endDate.diff(now, "month") + 1, 0),
            expiryDays: 0,
        };
        // Open all dataSet periods but only unapprove the given period
        await projectDb.updateDataSet(dataSet, openAttributes);
        if (unapprovePeriod) await this.setApprovalState(unapprovePeriod, false);
        return Project.get(this.api, this.config, this.project.id);
    }

    async reset(): Promise<Project> {
        const dataSet = this.getDataSet();
        const projectDb = new ProjectDb(this.project);
        const normalAttributes = this.getDefaultOpenAttributes();
        await projectDb.updateDataSet(dataSet, normalAttributes);
        // We don't know if the dataset was previously approved for some of the periods, so
        // we just keep the approval info untouched.
        return Project.get(this.api, this.config, this.project.id);
    }

    async setApprovalState(period: string, isApproved: boolean): Promise<void> {
        const url = "/dataApprovals/" + (isApproved ? "approvals" : "unapprovals");
        const dataSetId = this.getDataSet().id;
        const orgUnitId = this.getOrgUnit().id;
        const aoc = this.getAttributeOptionCombo();

        const params = {
            ds: [dataSetId],
            pe: [period],
            approvals: [{ ou: orgUnitId, aoc: aoc.id }],
        };

        await this.api.post(url, {}, params).getData();
    }

    async getOpenInfo(date: Moment): Promise<DataSetOpenInfo> {
        const defaultOpenAttributes = this.getDefaultOpenAttributes();
        const isPeriodOpenByDates = await this.isOpenByDates(date);
        const isPeriodOpenByData = !(await this.hasApprovedData(date));
        const isPeriodOpen = isPeriodOpenByDates && isPeriodOpenByData;
        const isDataSetReopened = !this.areOpenAttributesEquivalent(defaultOpenAttributes);
        return {
            isOpen: isPeriodOpen,
            isOpenByDates: isPeriodOpenByDates,
            isOpenByData: isPeriodOpenByData,
            isReopened: isDataSetReopened,
        };
    }

    async isOpenByDates(date: Moment): Promise<boolean> {
        return (
            this.arePeriodsOpen(date) &&
            this.isFuturePeriodsOpen(date) &&
            this.isExpiryDaysOpen(date)
        );
    }

    async getDataApproval(period: string) {
        const dataSet = this.getDataSet();
        const orgUnit = this.getOrgUnit();
        const aoc = this.getAttributeOptionCombo();
        const path = "/dataApprovals/categoryOptionCombos";
        const params = { ds: dataSet.id, pe: period, ou: orgUnit.id };
        const dataApprovalsAll = await this.api
            .get<DataApprovalCategoryOptionCombosResponse>(path, params)
            .getData();
        return dataApprovalsAll.find(da => da.ou === orgUnit.id && da.id === aoc.id);
    }

    getApprovalForm(period: string) {
        const orgUnit = this.getOrgUnit();
        const aoc = this.getAttributeOptionCombo();
        const dataSet = this.getDataSet();
        const params = { ds: dataSet.id, pe: period, ou: orgUnit.id, dimension: "ao:" + aoc.id };
        const path = "/dhis-web-reporting/generateDataSetReport.action";
        return this.api
            .request({ method: "get", url: path, params, skipApiPrefix: true })
            .getData();
    }

    private getAttributeOptionCombo() {
        const categoryOption = this.config.categoryOptions[this.dataSetType];
        const aoc = categoryOption.categoryOptionCombos[0];
        if (!aoc) throw new Error("Cannot get attribute option combo");
        return aoc;
    }

    private async hasApprovedData(date: Moment): Promise<boolean> {
        const period = date.format(monthFormat);
        const dataApproval = await this.getDataApproval(period);
        return !dataApproval ? false : dataApproval.accepted;
    }

    private areOpenAttributesEquivalent(dataSet: DataSetOpenAttributes): boolean {
        const thisDataSet = this.getDataSet();
        return (
            // Open future periods depends on the current date, so let's only check if the current
            // value is equal or greater than the expected.
            dataSet.openFuturePeriods <= thisDataSet.openFuturePeriods &&
            dataSet.expiryDays === thisDataSet.expiryDays &&
            areDateInputPeriodsEqual(dataSet.dataInputPeriods, thisDataSet.dataInputPeriods)
        );
    }

    private getDefaultOpenAttributes() {
        const projectDb = new ProjectDb(this.project);
        return projectDb.getDataSetOpenAttributes(this.dataSetType);
    }

    private arePeriodsOpen(date: Moment) {
        const dataSet = this.getDataSet();
        const period = date.format(monthFormat);
        const now = moment();
        const dataInputPeriod = dataSet.dataInputPeriods.find(dip => dip.period.id === period);
        if (!dataInputPeriod) return false;
        const openingDate = moment(dataInputPeriod.openingDate);
        const closingDate = moment(dataInputPeriod.closingDate);
        return now.isBetween(openingDate, closingDate);
    }

    private isFuturePeriodsOpen(date: Moment) {
        const dataSet = this.getDataSet();
        const now = moment();
        return Math.ceil(date.diff(now, "months", true)) < dataSet.openFuturePeriods;
    }

    private isExpiryDaysOpen(date: Moment): boolean {
        const dataSet = this.getDataSet();
        const now = moment();
        if (_.isNil(dataSet.expiryDays) || dataSet.expiryDays === 0) return true;

        return date
            .clone()
            .endOf("month")
            .add(dataSet.expiryDays - 1, "days")
            .isAfter(now);
    }
}

function expandDataInputPeriod(dip: D2DataInputPeriod) {
    const openingDate = moment(dip.openingDate);
    const closingDate = moment(dip.closingDate);
    const now = moment();

    return {
        ...dip,
        openingDate: toISOString(moment.min(openingDate, now.clone().startOf("day"))),
        closingDate: toISOString(moment.max(closingDate, now.clone().endOf("day"))),
    };
}

function areDateInputPeriodsEqual(dips1: D2DataInputPeriod[], dips2: D2DataInputPeriod[]): boolean {
    const toDay = (date: string) => date.split("T")[0];
    const process = (dips: D2DataInputPeriod[]) =>
        _(dips)
            .sortBy(dip => dip.period.id)
            .map(dip => ({
                ...dip,
                openingDate: toDay(dip.openingDate),
                closingDate: toDay(dip.closingDate),
            }))
            .value();

    const dips1P = process(dips1);
    const dips2P = process(dips2);
    return _.isEqual(dips1P, dips2P);
}
