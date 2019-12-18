import { GetItemType } from "./../types/utils";
import moment, { Moment } from "moment";
import _ from "lodash";
import { D2Api, Id } from "d2-api";
import { Config } from "./Config";
import { getIdFromOrgUnit, getDataStore } from "../utils/dhis2";
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

interface Data {
    date: Moment;
    organisationUnit: { path: string };
    projectsData: ProjectsData;
    executiveSummary: string;
    ministrySummary: string;
    projectedActivitiesNextMonth: string;
    staffSummary: StaffSummary;
}

export type StaffInfo = { fullTime: number; partTime: number };

const initialData = {
    executiveSummary: "",
    ministrySummary: "",
    projectedActivitiesNextMonth: "",
    staffSummary: _.fromPairs(staffKeys.map(key => [key, { fullTime: 0, partTime: 0 }])) as Record<
        StaffKey,
        StaffInfo
    >,
};

interface ProjectInfo {
    dataElements: string[];
}

interface DataStoreReport {
    created: string;
    createdBy: Id;
    updated: string;
    updatedBy: Id;
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
    achieved: number | undefined;
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

    static getReportKey(selectData: Pick<Data, "date" | "organisationUnit">): string {
        const { organisationUnit, date } = selectData;
        const dateString = date.format("YYYYMM");
        return ["mer", getIdFromOrgUnit(organisationUnit), dateString].join("-");
    }

    getReportKey() {
        return MerReport.getReportKey(this.data);
    }

    static async create(
        api: D2Api,
        config: Config,
        selectData: Pick<Data, "date" | "organisationUnit">
    ): Promise<MerReport> {
        const storeReport = await getDataStore(api)
            .get<DataStoreReport>(MerReport.getReportKey(selectData))
            .getData();
        const comments = storeReport ? storeReport.comments : {};

        const data: Data = {
            ...selectData,
            ...initialData,
            ..._.pick(storeReport, [
                "executiveSummary",
                "ministrySummary",
                "projectedActivitiesNextMonth",
                "staffSummary",
            ]),
            projectsData: await MerReport.getProjectsData(api, config, selectData, comments),
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
        const staffs = staffKeys.map(key => this.data.staffSummary[key]);
        const partTime = _.sum(staffs.map(staff => staff.partTime));
        const fullTime = _.sum(staffs.map(staff => staff.fullTime));
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
        const { dataStore, config } = this;
        const { organisationUnit, date, staffSummary } = this.data;
        const { executiveSummary, ministrySummary, projectedActivitiesNextMonth } = this.data;
        const storeReportKey = MerReport.getReportKey({ organisationUnit, date });
        const previousValue = await dataStore.get<DataStoreReport>(storeReportKey).getData();
        const comments = _(this.data.projectsData)
            .flatMap(projectInfo => {
                return projectInfo.dataElements.map(deInfo => {
                    return [getKey([projectInfo.id, deInfo.id]), deInfo.comment];
                });
            })
            .fromPairs()
            .value();

        const storeRerport: DataStoreReport = {
            created: previousValue ? previousValue.created : toISOString(date),
            createdBy: previousValue ? previousValue.createdBy : config.currentUser.id,
            updated: toISOString(date),
            updatedBy: config.currentUser.id,
            executiveSummary,
            ministrySummary,
            projectedActivitiesNextMonth,
            staffSummary,
            comments,
        };

        await dataStore.save(storeReportKey, storeRerport);
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
                        "parent.id": { eq: getIdFromOrgUnit(organisationUnit) },
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
                            .get<ProjectInfo>("mer-" + orgUnit.id)
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
        const reportPeriod = date.format("YYYYMM");
        const allDataElementIds = _(projectInfoByOrgUnitId)
            .values()
            .flatMap(info => info.dataElements)
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

        const projectsData: ProjectsData = organisationUnits.map(orgUnit => {
            const project = getProjectFromOrgUnit(orgUnit);
            const formatDate = (dateStr: string): string => moment(dateStr).format("MMM YYYY");
            const dataElementIds = _(projectInfoByOrgUnitId).getOrFail(orgUnit.id).dataElements;
            const getDataElementInfo = (deId: Id) => {
                const dataElement = _(dataElementsById).getOrFail(deId);
                const keyPrefix = [reportPeriod, orgUnit.id, dataElement.id];
                const values = valuesByOrgUnitAndDataElement[getKey([orgUnit.id, deId])] || [];
                const [allTarget, allActual] = _.partition(
                    values,
                    value => value.categoryOption === "target"
                );
                const sumActual = _.sum(allActual.map(v => v.value));
                const sumTarget = _.sum(allTarget.map(v => v.value));
                const allAchieved = sumTarget > 0 ? (100.0 * sumActual) / sumTarget : undefined;

                return {
                    id: dataElement.id,
                    name: dataElement.name,
                    actual: _(valuesByKey).get(getKey([...keyPrefix, "actual"]), 0.0),
                    target: _(valuesByKey).get(getKey([...keyPrefix, "target"]), 0.0),
                    achieved: allAchieved,
                };
            };

            return {
                id: orgUnit.id,
                name: project.displayName,
                dateInfo: `${formatDate(project.openingDate)} -> ${formatDate(project.closedDate)}`,
                dataElements: dataElementIds.map(getDataElementInfo).map(dataElementInfo => ({
                    ...dataElementInfo,
                    comment: _(commentsByProjectAndDataElement).get(
                        getKey([project.id, dataElementInfo.id]),
                        ""
                    ),
                })),
            };
        });

        return projectsData;
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

export type MerReportData = Data;

export default MerReport;
