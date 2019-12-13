import { Moment } from "moment";
import _ from "lodash";
import { D2Api } from "d2-api";
import { Config } from "./Config";
import { getIdFromOrgUnit } from "../utils/dhis2";

interface Data {
    date: Moment | null;
    organisationUnit: { path: string } | null;
}

export type ProjectsData = Array<{
    name: string;
    dataElements: Array<{
        name: string;
        target: number;
        actual: number;
        achieved: number;
        comment: string;
    }>;
}>;

class MerReport {
    constructor(public api: D2Api, public config: Config, public data: Data) {}

    static create(api: D2Api, config: Config, partialData: Partial<Data>) {
        const data = _.merge({ date: null, organisationUnit: null }, partialData);
        return new MerReport(api, config, data);
    }

    public set<K extends keyof Data>(field: K, value: Data[K]): MerReport {
        return new MerReport(this.api, this.config, { ...this.data, [field]: value });
    }

    public async getProjectsData(): Promise<ProjectsData> {
        const { date, organisationUnit } = this.data;
        if (!date || !organisationUnit) return [];

        const { organisationUnits } = await this.api.metadata
            .get({
                organisationUnits: {
                    fields: { id: true },
                    filter: { "parent.id": { eq: getIdFromOrgUnit(organisationUnit) } },
                },
            })
            .getData();

        console.log({ organisationUnits });
        return [
            {
                name: "Project1 (from -> to)",
                dataElements: [
                    {
                        name: "Data element1",
                        target: 10,
                        actual: 5,
                        achieved: 54.21,
                        comment: "",
                    },
                    {
                        name: "Data element2",
                        target: 12,
                        actual: 10,
                        achieved: 24.21,
                        comment: "",
                    },
                ],
            },
        ];
    }
}

export type MerReportData = Data;

export default MerReport;
