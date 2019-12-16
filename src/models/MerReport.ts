import { GetItemType } from "./../types/utils";
import moment, { Moment } from "moment";
import _ from "lodash";
import { D2Api, Id } from "d2-api";
import { Config } from "./Config";
import { getIdFromOrgUnit, getDataStore } from "../utils/dhis2";
import DataStore from "d2-api/api/dataStore";
import { runPromises } from "../utils/promises";
import { getProjectFromOrgUnit } from "./Project";
import { toISOString } from "../utils/date";

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
    date: Moment | null;
    organisationUnit: { path: string } | null;
    projectsData: ProjectsData | null;
    executiveSummary: string;
    ministrySummary: string;
    projectedActivitiesNextMonth: string;
    staffSummary: Record<StaffKey, StaffInfo>;
}

export type StaffInfo = { fullTime: number; partTime: number };

const initialData = {
    date: null,
    organisationUnit: null,
    projectsData: null,
    executiveSummary: "",
    ministrySummary: "",
    projectedActivitiesNextMonth: "",
    staffSummary: _.fromPairs(staffKeys.map(key => [key, { fullTime: 0, partTime: 0 }])),
};

interface ProjectInfo {
    dataElements: string[];
}

export interface DataElementInfo {
    id: string;
    name: string;
    target: number;
    actual: number;
    achieved: number;
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

    static create(api: D2Api, config: Config, partialData: Partial<Data>) {
        const data = _.merge(initialData, partialData);
        return new MerReport(api, config, data);
    }

    public set<K extends keyof Data>(field: K, value: Data[K]): MerReport {
        return new MerReport(this.api, this.config, { ...this.data, [field]: value });
    }

    async withProjectsData(): Promise<MerReport> {
        const projectsData = await this.getProjectsData();
        return this.set("projectsData", projectsData);
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

    public async getProjectsData(): Promise<ProjectsData> {
        const { date, organisationUnit } = this.data;
        if (!date || !organisationUnit) return [];

        const now = moment();
        const { organisationUnits } = await this.api.metadata
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

        const projectInfoByOrgUnitId = _.fromPairs(
            _.compact(
                await runPromises(
                    organisationUnits.map(orgUnit => () =>
                        this.dataStore
                            .get<ProjectInfo>("mer-" + orgUnit.id)
                            .getData()
                            .then(value => [orgUnit.id, value] as [string, ProjectInfo])
                    ),
                    { concurrency: 3 }
                )
            )
        );

        console.log({ organisationUnits, projectInfoByOrgUnitId });
        const period = date.format("YYYYMM");
        const allDataElementIds = _(projectInfoByOrgUnitId)
            .values()
            .flatMap(info => info.dataElements)
            .uniq()
            .value();

        const { categories, categoryOptions } = this.config;
        const catOptionsActualTargetIds = [categoryOptions.actual.id, categoryOptions.target.id];

        const data = await this.api.analytics
            .get({
                dimension: [
                    "ou:" + organisationUnits.map(ou => ou.id).join(";"),
                    "pe:" + period,
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
                [val.periodId, val.orgUnitId, val.dataElementId, val.categoryOption].join("-")
            )
            .mapValues(({ value }) => value)
            .value();

        const dataElementsById = _.keyBy(this.config.dataElements, "id");

        const projectsData = organisationUnits.map(orgUnit => {
            const project = getProjectFromOrgUnit(orgUnit);
            const formatDate = (dateStr: string): string => moment(dateStr).format("MMMM YYYY");
            const dataElementIds = _(projectInfoByOrgUnitId).getOrFail(orgUnit.id).dataElements;
            const getDataElement = (
                deId: Id
            ): { id: string; name: string; actual: number; target: number } => {
                const dataElement = _(dataElementsById).getOrFail(deId);
                const val = [period, orgUnit.id, dataElement.id];
                return {
                    id: dataElement.id,
                    name: dataElement.name,
                    actual: _(valuesByKey).get([...val, "actual"].join("-"), 0.0),
                    target: _(valuesByKey).get([...val, "target"].join("-"), 0.0),
                };
            };

            return {
                id: orgUnit.id,
                name: `${project.displayName} (${formatDate(project.openingDate)} -> ${formatDate(
                    project.closedDate
                )})`,

                dataElements: dataElementIds.map(getDataElement).map(dataElementInfo => ({
                    id: dataElementInfo.id,
                    name: dataElementInfo.name,
                    target: dataElementInfo.target,
                    actual: dataElementInfo.actual,
                    achieved: 0,
                    comment: "",
                })),
            };
        });

        console.log(projectsData);
        return projectsData;
    }
}

export type MerReportData = Data;

export default MerReport;
