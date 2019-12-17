import { GetItemType } from "./../types/utils";
import moment, { Moment } from "moment";
import _ from "lodash";
import { D2Api, Id } from "d2-api";
import { Config } from "./Config";
import { getIdFromOrgUnit, getDataStore } from "../utils/dhis2";
import DataStore from "d2-api/api/dataStore";
import { runPromises } from "../utils/promises";
import { getProjectFromOrgUnit } from "./Project";
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

interface Data {
    date: Moment;
    organisationUnit: { path: string };
    projectsData: ProjectsData;
    executiveSummary: string;
    ministrySummary: string;
    projectedActivitiesNextMonth: string;
    staffSummary: Record<StaffKey, StaffInfo>;
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
        const projectsData = await MerReport.getProjectsData(api, config, selectData);
        const data: Data = _.merge({}, initialData, selectData, { projectsData });
        return new MerReport(api, config, data);
    }

    public set<K extends keyof Data>(field: K, value: Data[K]): MerReport {
        return new MerReport(this.api, this.config, { ...this.data, [field]: value });
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

    static async getProjectsData(
        api: D2Api,
        config: Config,
        selectData: Pick<Data, "date" | "organisationUnit">
    ): Promise<ProjectsData> {
        const { date, organisationUnit } = selectData;
        const dataStore = getDataStore(api);
        const now = moment();
        const { organisationUnits } = await api.metadata
            .get({
                organisationUnits: {
                    fields: { id: true, displayName: true, openingDate: true, closedDate: true },
                    filter: {
                        "parent.id": { eq: getIdFromOrgUnit(organisationUnit) },
                        openingDate: { le: toISOString(now.clone().startOf("month")) },
                        closedDate: { ge: toISOString(now.clone().startOf("month")) },
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

        console.log({ organisationUnits, projectInfoByOrgUnitId });
        const oldestPeriod = _(organisationUnits)
            .map(orgUnit => orgUnit.openingDate)
            .compact()
            .min();

        const periods = getMonthsRange(moment(oldestPeriod), now).map(date =>
            date.format("YYYYMM")
        );
        const currentPeriod = now.format("YYYYMM");
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

        console.log({ data });

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
        console.log({ values: allValues });

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

        const projectsData = organisationUnits.map(orgUnit => {
            const project = getProjectFromOrgUnit(orgUnit);
            const formatDate = (dateStr: string): string => moment(dateStr).format("MMM YYYY");
            const dataElementIds = _(projectInfoByOrgUnitId).getOrFail(orgUnit.id).dataElements;
            const getDataElementInfo = (deId: Id) => {
                const dataElement = _(dataElementsById).getOrFail(deId);
                const keyPrefix = [currentPeriod, orgUnit.id, dataElement.id];
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
                name: `${project.displayName} (${formatDate(project.openingDate)} -> ${formatDate(
                    project.closedDate
                )})`,

                dataElements: dataElementIds.map(getDataElementInfo).map(dataElementInfo => ({
                    ...dataElementInfo,
                    comment: "",
                })),
            };
        });

        console.log(projectsData);
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
