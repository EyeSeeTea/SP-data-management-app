import _ from "lodash";
import { Ref } from "d2-api";
import Project from "./Project";
import { DataElement } from "./dataElementsSet";
import { getIds } from "../utils/dhis2";

type ValuesByKey = _.Dictionary<
    {
        dataElementId: string;
        orgUnitId: string;
        periodId: string;
        categoryOptionIds: Set<string>;
        value: number;
    }[]
>;

export default class ProjectAnalytics {
    constructor(public project: Project, private orgUnit: Ref, private valuesByKey: ValuesByKey) {}

    static async build(project: Project, dimensions: Ref[]): Promise<ProjectAnalytics> {
        const { api, orgUnit } = project;
        if (!orgUnit) throw new Error("Org unit missing");
        const dataElements = project.getSelectedDataElements();
        const periodIds = project.getPeriods().map(period => period.id);

        const rows = _.isEmpty(dataElements)
            ? []
            : await api.analytics
                  .get({
                      dimension: [
                          "ou:" + orgUnit.id,
                          "pe:" + periodIds.join(";"),
                          "dx:" + dataElements.map(de => de.id).join(";"),
                          ...getIds(dimensions),
                      ],
                  })
                  .getData()
                  .then(data => data.rows);

        const allValues = rows.map(row => {
            const baseIds = _.take(row, 3);
            const [deId, orgUnitId, periodId] = baseIds;
            const categoryOptionIds = _(row)
                .drop(baseIds.length)
                .take(dimensions.length)
                .value();
            const stringValue = row[baseIds.length + categoryOptionIds.length];
            return {
                dataElementId: deId,
                orgUnitId,
                periodId,
                categoryOptionIds: new Set(categoryOptionIds),
                value: parseFloat(stringValue),
            };
        });

        const valuesByKey = _(allValues)
            .groupBy(val =>
                ProjectAnalytics.getKey([val.periodId, val.orgUnitId, val.dataElementId])
            )
            .value();

        return new ProjectAnalytics(project, orgUnit, valuesByKey);
    }

    get(dataElement: DataElement, periodId: string, categoryOptions: Ref[]): number {
        const key = ProjectAnalytics.getKey([periodId, this.orgUnit.id, dataElement.id]);
        const data = this.valuesByKey[key] || [];
        const getCategoryOptionIds = new Set(getIds(categoryOptions));
        return _(data)
            .filter(({ categoryOptionIds }) => isSuperset(categoryOptionIds, getCategoryOptionIds))
            .map(({ value }) => value)
            .sum();
    }

    static getKey(ss: string[]): string {
        return ss.join("-");
    }
}

function isSuperset<T>(set: Set<T>, subset: Set<T>): boolean {
    return _(Array.from(subset)).every(elem => set.has(elem));
}
