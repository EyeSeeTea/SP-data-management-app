import _ from "lodash";
import { Config } from "./Config";
import { D2Api, Id, Ref, MetadataPayload } from "../types/d2-api";
import { getIds, getRefs, postMetadataRequests, getDataStore } from "../utils/dhis2";
import i18n from "../locales";
import { getProjectStorageKey } from "./MerReport";
import { runPromises } from "../utils/promises";
import { getDashboardId } from "./ProjectDb";

export default class ProjectDelete {
    constructor(private config: Config, private api: D2Api) {}

    public async delete(ids: Id[]): Promise<void> {
        const { api } = this;
        const { organisationUnits, dataSets, dashboards } = await this.getReferences(ids);
        const favoritesMetadata = this.getFavoritesMetadata(dashboards);
        const dataValues = await this.getDataValues(organisationUnits, dataSets);

        if (!_.isEmpty(dataValues)) {
            throw new Error(
                i18n.t(
                    "There are data values associated, the delete operation cannot be completed. Contact the administrators."
                )
            );
        } else {
            // When trying to delete dashboards and favorites on the same request, the api replies
            // 'Could not delete due to association with another object: DashboardItem'.
            // So first we remove the dashboards and then all the other metadata.
            const requests: Array<Partial<MetadataPayload>> = [
                {
                    dashboards: getRefs(dashboards),
                    organisationUnits: getRefs(organisationUnits),
                    dataSets: getRefs(dataSets),
                    ...favoritesMetadata,
                },
            ];

            await this.deleteProjectInDataStore(api, organisationUnits);
            const success = await postMetadataRequests(api, requests, { importStrategy: "DELETE" });

            if (!success) {
                throw new Error(i18n.t("Cannot delete projects"));
            }
        }
    }

    private async deleteProjectInDataStore(api: D2Api, organisationUnits: Ref[]) {
        const dataStore = getDataStore(api);

        return runPromises(
            organisationUnits.map(orgUnit => () =>
                dataStore.delete(getProjectStorageKey(orgUnit)).getData()
            ),
            { concurrency: 3 }
        );
    }

    private async getDataValues(organisationUnits: Ref[], dataSets: Ref[]) {
        if (_(organisationUnits).isEmpty() || _(dataSets).isEmpty()) return [];

        const { dataValues } = await this.api.dataValues
            .getSet({
                orgUnit: getIds(organisationUnits),
                dataSet: getIds(dataSets),
                lastUpdated: "1970",
                includeDeleted: true,
                limit: 1,
            })
            .getData();

        return dataValues;
    }

    private getFavoritesMetadata(
        dashboards: Array<{ id: Id; dashboardItems: Array<{ visualization: Ref }> }>
    ) {
        return _(dashboards)
            .flatMap(dashboard => dashboard.dashboardItems)
            .map(dashboardItem => ({ id: dashboardItem.visualization.id }))
            .thru(refs => ({ visualizations: refs }))
            .value();
    }

    private async getReferences(ids: Id[]) {
        const { config, api } = this;

        const { organisationUnits, dataSets } = await api.metadata
            .get({
                organisationUnits: {
                    fields: {
                        id: true,
                        attributeValues: { attribute: { id: true }, value: true },
                    },
                    filter: { id: { in: ids } },
                },
                dataSets: {
                    fields: { id: true, sections: { id: true } },
                    filter: { "attributeValues.value": { in: ids } },
                },
            })
            .getData();

        const dashboardIds = _(organisationUnits)
            .map(orgUnit => getDashboardId(config, orgUnit))
            .compact()
            .value();

        const { dashboards } = await api.metadata
            .get({
                dashboards: {
                    fields: {
                        id: true,
                        dashboardItems: {
                            id: true,
                            visualization: { id: true },
                        },
                    },
                    filter: { id: { in: dashboardIds } },
                },
            })
            .getData();

        return { organisationUnits, dataSets, dashboards };
    }
}
