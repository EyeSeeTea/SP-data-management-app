import { StaffSummary } from "./MerReport";
import { GetItemType } from "./../types/utils";
import moment, { Moment } from "moment";
import _ from "lodash";
import { D2Api, Id, Ref } from "d2-api";
import { Config } from "./Config";
import { getDataStore } from "../utils/dhis2";
import DataStore from "d2-api/api/dataStore";
import { runPromises } from "../utils/promises";
import { getProjectFromOrgUnit, getOrgUnitDatesFromProject } from "./Project";
import { toISOString, getMonthsRange } from "../utils/date";
import i18n from "../locales";

export const staffKeys = [
    "nationalStaff" as const,
    "ifs" as const,
    "ifsDependents" as const,
    "regional" as const,
    "regionalDependents" as const,
    "interns" as const,
];

export type StaffKey = GetItemType<typeof staffKeys>;

export type StaffSummary = Record<StaffKey, StaffInfo>;

const emptyStaffSummary = {} as StaffSummary;

export type StaffInfo = { fullTime: Maybe<number>; partTime: Maybe<number> };

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

const initialData = {
    countryDirector: "",
    executiveSummary: "",
    ministrySummary: "",
    projectedActivitiesNextMonth: "",
    staffSummary: _.fromPairs(
        staffKeys.map(key => [key, { fullTime: null, partTime: null }])
    ) as Record<StaffKey, StaffInfo>,
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
    staffSummary: Record<StaffKey, StaffInfo>;
    comments: {
        [orgUnitCountryAndDataElementId: string]: string;
    };
}

export interface DataElementInfo {
    id: string;
    name: string;
    target: number;
    actual: number;
    achieved: number | null;
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
                "staffSummary",
            ]),
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
        const { reportInfo: oldProjectInfo, report: oldReport, reportPeriod } = reportData;
        const oldEmptyStaffSummary = oldReport ? oldReport.staffSummary : emptyStaffSummary;
        const newStaffSummary = mergeNotEqual(oldEmptyStaffSummary, staffSummary);

        const comments = _(projectsData)
            .flatMap(projectInfo => {
                return projectInfo.dataElements.map(deInfo => {
                    return [getKey([projectInfo.id, deInfo.id]), deInfo.comment];
                });
            })
            .fromPairs()
            .value();

        const storeReport: Report = {
            created: oldReport ? oldReport.created : toISOString(now),
            createdBy: oldReport ? oldReport.createdBy : config.currentUser.id,
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
            ...oldProjectInfo,
            reports: {
                ...(oldProjectInfo && oldProjectInfo.reports),
                [reportPeriod]: storeReport,
            },
        };

        await dataStore.save(storeReportKey, newStoreValue);
    }

    static async getProjectsData(
        api: D2Api,
        config: Config,
        selectData: Pick<Data, "date" | "organisationUnit">,
        commentsByProjectAndDataElement: _.Dictionary<string>
    ): Promise<ProjectsData> {
        const { date, organisationUnit } = selectData;
        const dataStore = getDataStore(api);
        const startOfMonth = date.clone().startOf("month");
        const dates = getOrgUnitDatesFromProject(startOfMonth, startOfMonth);
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

        if (_.isEmpty(organisationUnits)) return [];

        const projectInfoByOrgUnitId = _.fromPairs(
            _.compact(
                await runPromises(
                    organisationUnits.map(orgUnit => () =>
                        dataStore
                            .get<ProjectInfo | undefined>(getProjectStorageKey(orgUnit))
                            .getData()
                            .then(value => [orgUnit.id, value] as [string, ProjectInfo])
                    ),
                    { concurrency: 3 }
                )
            )
        );

        const oldestPeriod = _(organisationUnits)
            .map(orgUnit => orgUnit.openingDate)
            .compact()
            .min();

        const months = getMonthsRange(moment(oldestPeriod), date);
        const periods = months.map(date => date.format("YYYYMM"));
        const reportPeriod = getReportPeriod(date);
        const allDataElementIds = _(projectInfoByOrgUnitId)
            .values()
            .flatMap(info => (info ? info.merDataElementIds : []))
            .uniq()
            .value();

        if (_.isEmpty(allDataElementIds)) return [];

        const { categories, categoryOptions } = config;
        const catOptionsActualTargetIds = [categoryOptions.actual.id, categoryOptions.target.id];

        const data = await api.analytics
            .get({
                dimension: [
                    "ou:" + organisationUnits.map(ou => ou.id).join(";"),
                    "pe:" + periods.join(";"),
                    categories.targetActual.id + ":" + catOptionsActualTargetIds.join(";"),
                    "dx:" + allDataElementIds.join(";"),
                ],
            })
            .getData();

        const actualTarget: Record<string, "actual" | "target"> = {
            [categoryOptions.actual.id]: "actual",
            [categoryOptions.target.id]: "target",
        };

        const allValues = data.rows.map(([deId, orgUnitId, periodId, coId, stringValue]) => ({
            dataElementId: deId,
            orgUnitId,
            periodId,
            categoryOption: actualTarget[coId],
            value: parseFloat(stringValue),
        }));

        const valuesByKey = _(allValues)
            .keyBy(val =>
                getKey([val.periodId, val.orgUnitId, val.dataElementId, val.categoryOption])
            )
            .mapValues(({ value }) => value)
            .value();

        const valuesByOrgUnitAndDataElement = _(allValues)
            .groupBy(val => getKey([val.orgUnitId, val.dataElementId]))
            .value();

        const dataElementsById = _.keyBy(config.dataElements, "id");

        const projectsData: Array<Project | null> = organisationUnits.map(orgUnit => {
            const project = getProjectFromOrgUnit(orgUnit);
            const formatDate = (dateStr: string): string => moment(dateStr).format("MMM YYYY");
            const projectInfo = projectInfoByOrgUnitId[orgUnit.id];
            const dataElementIds = projectInfo ? projectInfo.merDataElementIds : [];
            const getDataElementInfo = (deId: Id) => {
                const dataElement = _(dataElementsById).get(deId, null);
                if (!dataElement) {
                    console.error(`Cannot found data element: ${deId}`);
                    return;
                }

                const keyPrefix = [reportPeriod, orgUnit.id, dataElement.id];
                const values = valuesByOrgUnitAndDataElement[getKey([orgUnit.id, deId])] || [];
                const [allTarget, allActual] = _.partition(
                    values,
                    value => value.categoryOption === "target"
                );
                const sumActual = _.sum(allActual.map(v => v.value));
                const sumTarget = _.sum(allTarget.map(v => v.value));
                const allAchieved = sumTarget > 0 ? (100.0 * sumActual) / sumTarget : null;

                return {
                    id: dataElement.id,
                    name: dataElement.name,
                    actual: _(valuesByKey).get(getKey([...keyPrefix, "actual"]), 0.0),
                    target: _(valuesByKey).get(getKey([...keyPrefix, "target"]), 0.0),
                    achieved: allAchieved,
                };
            };
            if (_.isEmpty(dataElementIds)) return null;

            const dataElements = _(dataElementIds)
                .map(getDataElementInfo)
                .compact()
                .map(dataElementInfo => ({
                    ...dataElementInfo,
                    comment: _(commentsByProjectAndDataElement).get(
                        getKey([project.id, dataElementInfo.id]),
                        ""
                    ),
                }))
                .value();

            return {
                id: orgUnit.id,
                name: project.displayName,
                dateInfo: `${formatDate(project.openingDate)} -> ${formatDate(project.closedDate)}`,
                dataElements,
            };
        });

        return _.compact(projectsData);
    }
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

type Maybe<T> = T | undefined | null;

async function getReportData<OU extends Ref>(
    api: D2Api,
    organisationUnit: OU,
    date: Moment
): Promise<{
    reportInfo: Maybe<ReportInfo>;
    report: Maybe<Report>;
    reportPeriod: string;
}> {
    const reportInfo = await getDataStore(api)
        .get<ReportInfo | undefined>(getReportStorageKey(organisationUnit))
        .getData();
    const reportPeriod = getReportPeriod(date);
    const reports = reportInfo ? reportInfo.reports : undefined;
    const report = reports ? reports[reportPeriod] : undefined;

    // Merge old and current values to build the final staff summary for this period
    const staffSummary = _(reports)
        .toPairs()
        .sortBy(([period, _report]) => period)
        .map(([period, report]) => (period <= reportPeriod ? report : null))
        .compact()
        .reduce((acc, report) => mergeNotNil(acc, report.staffSummary), emptyStaffSummary);

    const reportWithStaffSummary = report ? { ...report, staffSummary } : undefined;

    return { reportInfo, report: reportWithStaffSummary, reportPeriod };
}

function mergeNotNil<T>(obj1: T, obj2: T): T {
    return _.mergeWith({}, obj1, obj2, (val1, val2) => (_.isNil(val2) ? val1 : undefined));
}

function mergeNotEqual<T>(obj1: T, obj2: T): T {
    return _.mergeWith({}, obj1, obj2, (val1, val2) =>
        typeof val1 === "object" ? undefined : val1 === val2 ? null : val2
    );
}

export type MerReportData = Data;

export default MerReport;
