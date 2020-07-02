import { GetItemType } from "./../types/utils";
import moment, { Moment } from "moment";
import _ from "lodash";
import { Id, Ref, D2Api, D2OrganisationUnit, DataStore } from "../types/d2-api";
import { Config } from "./Config";
import { getDataStore } from "../utils/dhis2";
import { runPromises } from "../utils/promises";
import { getProjectFromOrgUnit, getOrgUnitDatesFromProject } from "./Project";
import { toISOString, getMonthsRange } from "../utils/date";
import i18n from "../locales";
import { DataElementBase } from "./dataElementsSet";

export const staffKeys = [
    "nationalStaff" as const,
    "ifs" as const,
    "ifsDependents" as const,
    "regional" as const,
    "regionalDependents" as const,
    "interns" as const,
];

export type StaffKey = GetItemType<typeof staffKeys>;

export type StaffSummary = Partial<Record<StaffKey, StaffInfo>>;

export type StaffInfo = Partial<{ fullTime: number; partTime: number }>;

interface OrganisationUnit {
    id: string;
    path: string;
    displayName: string;
}

interface Data {
    date: Moment;
    organisationUnit: OrganisationUnit;
    projectsData: ProjectsData;
    countryDirector: string;
    executiveSummary: string;
    ministrySummary: string;
    projectedActivitiesNextMonth: string;
    staffSummary: StaffSummary;
}

interface Row {
    deId: string;
    orgUnitId: string;
    periodId: string;
    actualOrTarget: "actual" | "target";
    newOrRecurring: "new" | "recurring" | undefined;
    isPeople: boolean;
    value: number;
}

const emptyStaffSummary: StaffSummary = {};

const initialData = {
    countryDirector: "",
    executiveSummary: "",
    ministrySummary: "",
    projectedActivitiesNextMonth: "",
    staffSummary: emptyStaffSummary,
};

export interface ProjectInfo {
    merDataElementIds: string[];
}

interface ReportInfo {
    reports?: Record<string, Report>;
}

interface Report {
    created: string;
    createdBy: Id;
    updated: string;
    updatedBy: Id;
    countryDirector: string;
    executiveSummary: string;
    ministrySummary: string;
    projectedActivitiesNextMonth: string;
    staffSummary: StaffSummary;
    comments: {
        [orgUnitCountryAndDataElementId: string]: string;
    };
}

export interface DataElementInfo {
    id: string;
    name: string;
    target: number;
    actual: number;
    targetAchieved: number;
    actualAchieved: number;
    achieved: Maybe<number>;
    comment: string;
}

export interface Project {
    id: string;
    dateInfo: string;
    name: string;
    dataElements: Array<DataElementInfo>;
}

export type ProjectsData = Array<Project>;

class MerReport {
    dataStore: DataStore;

    constructor(public api: D2Api, public config: Config, public data: Data) {
        this.dataStore = getDataStore(this.api);
    }

    static async create(
        api: D2Api,
        config: Config,
        selectData: Pick<Data, "date" | "organisationUnit">
    ): Promise<MerReport> {
        const { organisationUnit, date } = selectData;
        const reportData = await getReportData(api, organisationUnit, date);
        const { report } = reportData;
        const comments = report ? report.comments : {};
        const projectsData = await MerReport.getProjectsData(api, config, selectData, comments);

        const data: Data = {
            ...selectData,
            ...initialData,
            ..._.pick(report, [
                "countryDirector",
                "executiveSummary",
                "ministrySummary",
                "projectedActivitiesNextMonth",
            ]),
            staffSummary: reportData.staffSummaryCurrent,
            projectsData,
        };
        return new MerReport(api, config, data);
    }

    public set<K extends keyof Data>(field: K, value: Data[K]): MerReport {
        return new MerReport(this.api, this.config, { ...this.data, [field]: value });
    }

    hasProjects(): boolean {
        return this.data.projectsData.length > 0;
    }

    getStaffTotals(): { partTime: number; fullTime: number; total: number } {
        const staffs = staffKeys.map(key => _(this.data.staffSummary).get(key, undefined));
        const partTime = _.sum(_.compact(staffs.map(staff => (staff ? staff.partTime : null))));
        const fullTime = _.sum(_.compact(staffs.map(staff => (staff ? staff.fullTime : null))));
        return { partTime, fullTime, total: partTime + fullTime };
    }

    setComment(project: Project, dataElement: DataElementInfo, comment: string): MerReport {
        if (!this.data.projectsData) return this;

        const projectDataUpdated = this.data.projectsData.map(project_ => {
            if (project_.id === project.id) {
                return {
                    ...project_,
                    dataElements: project_.dataElements.map(dataElement_ => {
                        if (dataElement_.id === dataElement.id) {
                            return { ...dataElement_, comment };
                        } else {
                            return dataElement_;
                        }
                    }),
                };
            } else {
                return project_;
            }
        });
        return this.set("projectsData", projectDataUpdated);
    }

    setStaffHours(staffKey: StaffKey, staffInfo: StaffInfo): MerReport {
        const staffSummaryUpdated = {
            ...this.data.staffSummary,
            [staffKey]: staffInfo,
        };
        return this.set("staffSummary", staffSummaryUpdated);
    }

    async save(): Promise<void> {
        const { dataStore, config, api } = this;
        const { projectsData, organisationUnit, date, staffSummary } = this.data;
        const { countryDirector, executiveSummary } = this.data;
        const { ministrySummary, projectedActivitiesNextMonth } = this.data;
        const now = moment();
        const storeReportKey = getReportStorageKey(organisationUnit);
        const reportData = await getReportData(api, organisationUnit, date);
        const { reportInfo: reportInfoOld, report: reportOld } = reportData;
        const { reportPeriod, staffSummaryPrev } = reportData;
        const newStaffSummary = mergeNotEqual(staffSummaryPrev, staffSummary);

        const comments = _(projectsData)
            .flatMap(projectInfo => {
                return projectInfo.dataElements.map(deInfo => {
                    return [getKey([projectInfo.id, deInfo.id]), deInfo.comment];
                });
            })
            .fromPairs()
            .value();

        const storeReport: Report = {
            created: reportOld ? reportOld.created : toISOString(now),
            createdBy: reportOld ? reportOld.createdBy : config.currentUser.id,
            updated: toISOString(now),
            updatedBy: config.currentUser.id,
            countryDirector,
            executiveSummary,
            ministrySummary,
            projectedActivitiesNextMonth,
            staffSummary: newStaffSummary,
            comments,
        };

        const newStoreValue: ReportInfo = {
            ...reportInfoOld,
            reports: {
                ...(reportInfoOld && reportInfoOld.reports),
                [reportPeriod]: storeReport,
            },
        };

        await dataStore.save(storeReportKey, newStoreValue);
    }

    static async getProjectsData(
        api: D2Api,
        config: Config,
        selectData: Pick<Data, "date" | "organisationUnit">,
        commentsByProjectAndDe: _.Dictionary<string>
    ): Promise<ProjectsData> {
        const { date, organisationUnit } = selectData;
        const startOfMonth = date.clone().startOf("month");
        const dates = getOrgUnitDatesFromProject(startOfMonth, startOfMonth);
        const orgUnits = await getOrgUnits(api, organisationUnit, dates);
        if (_.isEmpty(orgUnits)) return [];

        const projectInfoByOrgUnitId = await getProjectInfoByOrgUnitId(api, orgUnits);
        const oldestPeriod = _.min(_.compact(orgUnits.map(orgUnit => orgUnit.openingDate)));
        const dataElementsById = getDataElementsById(config);
        const months = getMonthsRange(moment(oldestPeriod), date);
        const periods = months.map(date => date.format("YYYYMM"));
        const reportPeriod = getReportPeriod(date);

        const merDataElements = _(projectInfoByOrgUnitId)
            .values()
            .flatMap(info => (info ? info.merDataElementIds : []))
            .uniq()
            .map(deId => _(dataElementsById).get(deId, null))
            .compact()
            .value();

        if (_.isEmpty(merDataElements)) return [];

        const rows = await getAnalyticRows(config, api, orgUnits, periods, merDataElements);

        const projectsData: Array<Project | null> = orgUnits.map(orgUnit => {
            const project = getProjectFromOrgUnit(orgUnit);
            const formatDate = (dateStr: string): string => moment(dateStr).format("MMM YYYY");
            const projectInfo = projectInfoByOrgUnitId[orgUnit.id];
            const dataElementIds = _.uniq(projectInfo ? projectInfo.merDataElementIds : []);
            const getDataElementInfo = (deId: Id) => {
                const dataElement = _(dataElementsById).get(deId, null);
                if (!dataElement) {
                    console.error(`Cannot found data element: ${deId}`);
                    return;
                }

                const rowsForDeOU = rows.filter(
                    row => row.deId === dataElement.id && row.orgUnitId === orgUnit.id
                );
                const targetAchieved = sumRows(
                    rowsForDeOU,
                    row =>
                        row.actualOrTarget === "target" &&
                        (!row.isPeople || row.newOrRecurring === "new")
                );
                const actualAchieved = sumRows(
                    rowsForDeOU,
                    row =>
                        row.actualOrTarget === "actual" &&
                        (!row.isPeople || row.newOrRecurring === "new")
                );
                const achieved = targetAchieved ? (100 * actualAchieved) / targetAchieved : null;
                const rowsForDeOrgUnitPeriod = rowsForDeOU.filter(r => r.periodId === reportPeriod);

                return {
                    id: dataElement.id,
                    name: dataElement.name,
                    actual: sumRows(rowsForDeOrgUnitPeriod, row => row.actualOrTarget === "actual"),
                    target: sumRows(rowsForDeOrgUnitPeriod, row => row.actualOrTarget === "target"),
                    actualAchieved,
                    targetAchieved,
                    achieved,
                    comment: commentsByProjectAndDe[getKey([project.id, dataElement.id])] || "",
                } as DataElementInfo;
            };

            if (_.isEmpty(dataElementIds)) return null;

            return {
                id: orgUnit.id,
                name: project.displayName,
                dateInfo: `${formatDate(project.openingDate)} -> ${formatDate(project.closedDate)}`,
                dataElements: _.compact(dataElementIds.map(getDataElementInfo)),
            };
        });

        return _.compact(projectsData);
    }
}

async function getOrgUnits(
    api: D2Api,
    organisationUnit: OrganisationUnit,
    dates: Pick<D2OrganisationUnit, "openingDate" | "closedDate">
) {
    const { organisationUnits } = await api.metadata
        .get({
            organisationUnits: {
                fields: { id: true, displayName: true, openingDate: true, closedDate: true },
                filter: {
                    "parent.id": { eq: organisationUnit.id },
                    openingDate: { le: dates.openingDate },
                    closedDate: { ge: dates.closedDate },
                },
            },
        })
        .getData();

    return organisationUnits;
}

async function getProjectInfoByOrgUnitId(api: D2Api, orgUnits: Ref[]) {
    const dataStore = getDataStore(api);
    return _.fromPairs(
        _.compact(
            await runPromises(
                orgUnits.map(orgUnit => () =>
                    dataStore
                        .get<ProjectInfo | undefined>(getProjectStorageKey(orgUnit))
                        .getData()
                        .then(value => [orgUnit.id, value] as [string, ProjectInfo])
                ),
                { concurrency: 3 }
            )
        )
    );
}

export function getStaffTranslations(): Record<StaffKey, string> {
    return {
        nationalStaff: i18n.t("National Staff"),
        ifs: i18n.t("IFS"),
        ifsDependents: i18n.t("IFS Dependents"),
        regional: i18n.t("Regional"),
        regionalDependents: i18n.t("Regional Dependents"),
        interns: i18n.t("Interns"),
    };
}

function getKey(parts: string[]): string {
    return parts.join("-");
}

function getReportPeriod(date: Moment): string {
    return date.format("YYYYMM");
}

export function getProjectStorageKey(organisationUnit: Ref): string {
    return ["project", organisationUnit.id].join("-");
}

function getReportStorageKey(organisationUnit: Ref): string {
    return ["mer", organisationUnit.id].join("-");
}

async function getAnalyticRows(
    config: Config,
    api: D2Api,
    organisationUnits: Ref[],
    periods: string[],
    merDataElements: DataElementBase[]
) {
    const { categories, categoryOptions } = config;
    const dataElementsById = getDataElementsById(config);

    const baseDimension = [
        "ou:" + organisationUnits.map(ou => ou.id).join(";"),
        "pe:" + periods.join(";"),
        categories.targetActual.id,
    ];

    const benefitDataElements = merDataElements.filter(de => de.peopleOrBenefit === "benefit");
    const peopleDataElements = merDataElements.filter(de => de.peopleOrBenefit === "people");

    const { rows: benefitRows } = _(benefitDataElements).isEmpty()
        ? { rows: [] }
        : await api.analytics
              .get({
                  dimension: [
                      ...baseDimension,
                      "dx:" + benefitDataElements.map(de => de.id).join(";"),
                  ],
              })
              .getData();

    const { rows: peopleRows } = _(peopleDataElements).isEmpty()
        ? { rows: [] }
        : await api.analytics
              .get({
                  dimension: [
                      ...baseDimension,
                      categories.newRecurring.id,
                      "dx:" + peopleDataElements.map(de => de.id).join(";"),
                  ],
              })
              .getData();

    const analyticsRows = _.concat(benefitRows, peopleRows);

    const actualTarget: Record<string, "actual" | "target"> = {
        [categoryOptions.actual.id]: "actual",
        [categoryOptions.target.id]: "target",
    };

    const newRecurring: Record<string, "new" | "recurring"> = {
        [categoryOptions.new.id]: "new",
        [categoryOptions.recurring.id]: "recurring",
    };

    const rows = analyticsRows.map(analyticsRow => {
        const deId = analyticsRow[0];
        const dataElement = _(dataElementsById).get(deId, null);
        const isPeople = dataElement ? dataElement.peopleOrBenefit === "people" : false;
        let orgUnitId, periodId, actualOrTargetId, newOrRecurringId, value;

        if (isPeople) {
            [, orgUnitId, periodId, actualOrTargetId, newOrRecurringId, value] = analyticsRow;
        } else {
            [, orgUnitId, periodId, actualOrTargetId, value] = analyticsRow;
            newOrRecurringId = undefined;
        }

        const row: Row = {
            deId,
            orgUnitId,
            periodId,
            actualOrTarget: actualTarget[actualOrTargetId],
            newOrRecurring: newOrRecurringId ? newRecurring[newOrRecurringId] : undefined,
            isPeople,
            value: parseFloat(value),
        };

        return row;
    });

    return rows;
}

type Maybe<T> = T | undefined | null;

async function getReportData<OU extends Ref>(
    api: D2Api,
    organisationUnit: OU,
    date: Moment
): Promise<{
    reportInfo: Maybe<ReportInfo>;
    report: Maybe<Report>;
    reportPeriod: string;
    staffSummaryPrev: StaffSummary;
    staffSummaryCurrent: StaffSummary;
}> {
    const reportInfo = await getDataStore(api)
        .get<ReportInfo | undefined>(getReportStorageKey(organisationUnit))
        .getData();
    const reportPeriod = getReportPeriod(date);
    const reports = reportInfo ? reportInfo.reports : undefined;
    const report = reports ? reports[reportPeriod] : undefined;

    // Merge old and current values to build the final staff summary for this period
    const staffSummaryPrev = _(reports)
        .toPairs()
        .sortBy(([period, _report]) => period)
        .map(([period, report]) => (period < reportPeriod ? report : null))
        .compact()
        .reduce((acc, report) => mergeNotNil(acc, report.staffSummary), emptyStaffSummary);

    const staffSummaryCurrent = report
        ? mergeNotNil(staffSummaryPrev, report.staffSummary)
        : staffSummaryPrev;

    return { reportInfo, staffSummaryPrev, staffSummaryCurrent, report, reportPeriod };
}

function mergeNotNil<T>(staff1: StaffSummary, staff2: StaffSummary): StaffSummary {
    return mergeStaffSummaries(staff1, staff2, (val1, val2) => (_.isNil(val2) ? val1 : val2));
}

function mergeNotEqual(staff1: StaffSummary, staff2: StaffSummary): StaffSummary {
    return mergeStaffSummaries(staff1, staff2, (val1, val2) =>
        _.isNil(val1) ? val2 : val1 === val2 ? undefined : val2
    );
}

function mergeStaffSummaries(
    staff1: StaffSummary,
    staff2: StaffSummary,
    merger: (val1: Maybe<number>, val2: Maybe<number>) => Maybe<number>
): StaffSummary {
    return _(staffKeys)
        .map(staffKey => {
            const time1 = staff1[staffKey] || {};
            const time2 = staff2[staffKey] || {};
            const fullTime = merger(time1.fullTime, time2.fullTime);
            const partTime = merger(time1.partTime, time2.partTime);
            return [staffKey, _.omitBy({ partTime, fullTime }, _.isNil)];
        })
        .fromPairs()
        .thru(staffSummary => _.omitBy(staffSummary, _.isEmpty))
        .value();
}

function sumRows<T extends { value: number }>(rows: T[], filterPredicate: (row: T) => boolean) {
    return _(rows)
        .filter(filterPredicate)
        .map(row => row.value)
        .sum();
}

function getDataElementsById(config: Config) {
    const allDataElements = _(config.dataElements)
        .uniqBy(de => de.id)
        .value();
    return _.keyBy(allDataElements, "id");
}

export type MerReportData = Data;

export default MerReport;