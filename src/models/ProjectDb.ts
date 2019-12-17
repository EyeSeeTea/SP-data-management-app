import _ from "lodash";
import moment from "moment";
import { D2DataSet, D2OrganisationUnit, D2ApiResponse, MetadataPayload, Id } from "d2-api";
import { PartialModel, Ref, PartialPersistedModel, MetadataResponse } from "d2-api";
import Project, { getOrgUnitDatesFromProject } from "./Project";
import { getMonthsRange, toISOString } from "../utils/date";
import "../utils/lodash-mixins";
import ProjectDashboard from "./ProjectDashboard";
import { getUid, getDataStore } from "../utils/dhis2";

const expiryDaysInMonthActual = 10;

export default class ProjectDb {
    constructor(public project: Project) {}

    async save() {
        const saveReponse = await this.saveMetadata();
        this.updateOrgUnit(saveReponse.response, saveReponse.orgUnit);
        return saveReponse;
    }

    async saveMetadata() {
        const { project } = this;
        const { api, config } = project;
        const { startDate, endDate } = project;

        if (!startDate || !endDate) {
            throw new Error("Missing dates");
        } else if (!project.parentOrgUnit) {
            throw new Error("No parent org unit");
        }

        const baseAttributeValues = [
            { value: "true", attribute: { id: config.attributes.createdByApp.id } },
        ];

        const parentOrgUnitId = getOrgUnitId(project.parentOrgUnit);
        const orgUnitId = getUid("organisationUnit", project.uid);
        const orgUnit = {
            id: orgUnitId,
            name: project.name,
            path: project.parentOrgUnit.path + "/" + orgUnitId,
            code: project.code,
            shortName: project.shortName,
            description: project.description,
            parent: { id: parentOrgUnitId },
            ...getOrgUnitDatesFromProject(startDate, endDate),
            openingDate: toISOString(startDate.clone().subtract(1, "month")),
            closedDate: toISOString(endDate.clone().add(1, "month")),
            organisationUnitGroups: project.funders.map(funder => ({ id: funder.id })),
            attributeValues: baseAttributeValues,
        };

        const projectWithOrgUnit = project.set("orgUnit", { path: orgUnit.path });

        const dashboardsMetadata = new ProjectDashboard(projectWithOrgUnit).generate();
        const dashboard = dashboardsMetadata.dashboards[0];
        if (!dashboard) throw new Error("No dashboard defined");

        const orgUnitToSave = {
            ...orgUnit,
            attributeValues: addAttributeValue(
                orgUnit.attributeValues,
                config.attributes.projectDashboard,
                dashboard.id
            ),
        };

        const { organisationUnitGroups: existingOrgUnitGroupFunders } = await api.metadata
            .get({
                organisationUnitGroups: {
                    fields: { $owner: true },
                    filter: { id: { in: project.funders.map(funder => funder.id) } },
                },
            })
            .getData();

        const newOrgUnitGroupFunders = existingOrgUnitGroupFunders.map(ouGroup => ({
            ...ouGroup,
            organisationUnits: [...ouGroup.organisationUnits, { id: orgUnit.id }],
        }));

        const dataSetAttributeValues = addAttributeValue(
            baseAttributeValues,
            config.attributes.orgUnitProject,
            orgUnit.id
        );

        const { targetPeriods, actualPeriods } = getDataSetPeriods(startDate, endDate);

        const dataSetTargetMetadata = this.getDataSetsMetadata(orgUnit, {
            name: `${project.name} Target`,
            code: "TARGET",
            openFuturePeriods: endDate.diff(moment(), "month") + 1,
            dataInputPeriods: targetPeriods,
            expiryDays: 0,
            attributeValues: dataSetAttributeValues,
        });

        const dataSetActualMetadata = this.getDataSetsMetadata(orgUnit, {
            name: `${project.name} Actual`,
            code: "ACTUAL",
            openFuturePeriods: 1,
            dataInputPeriods: actualPeriods,
            expiryDays: expiryDaysInMonthActual + 1,
            attributeValues: dataSetAttributeValues,
        });

        const orgUnitsMetadata: Pick<
            MetadataPayload,
            "organisationUnits" | "organisationUnitGroups"
        > = {
            organisationUnits: [orgUnitToSave],
            organisationUnitGroups: newOrgUnitGroupFunders,
        };

        const payload = flattenPayloads([
            orgUnitsMetadata,
            dataSetTargetMetadata,
            dataSetActualMetadata,
            dashboardsMetadata,
        ]);

        await this.saveMERData(orgUnit.id).getData();

        const response = await api.metadata.post(payload).getData();

        return { orgUnit: orgUnitToSave, payload, response, project: this.project };
    }

    saveMERData(orgUnitId: Id): D2ApiResponse<void> {
        const dataStore = getDataStore(this.project.api);
        const dataElementsForMER = this.project.dataElements.get({ onlyMERSelected: true });
        const value = { dataElements: dataElementsForMER.map(de => de.id) };
        return dataStore.save(`mer-${orgUnitId}`, value);
    }

    /*
    Creating the orgUnit in the metadata endpoint has two problems regarding the
    getOrganisationUnitTree.action endpoint:

    1. The version field is reset only when using the specific model endpoint, when using
        a metadata POST, the orgUnit tree in data entry is not updated.

    2. There seems to be a bug with fields odate/cdate: sometimes they will be saved as
        a long date format ("Fri Nov 08 09:49:00 GMT 2019"), instead of the correct format "YYYY-MM-DD",
        which breaks the data-entry JS code.

    Solution: Re-save the orgUnit using a PUT /api/organisationUnits.

    This is a desisable request to finish, but don't stop the saving process in case of error.
    */
    async updateOrgUnit(
        response: MetadataResponse,
        orgUnit: PartialPersistedModel<D2OrganisationUnit>
    ) {
        if (response.status === "OK") {
            await this.project.api.models.organisationUnits
                .put(orgUnit)
                .getData()
                .then(() => true)
                .catch(() => false);
        }
    }

    getDataSetsMetadata<T extends PartialPersistedModel<D2OrganisationUnit>>(
        orgUnit: T,
        baseDataSet: PartialModel<D2DataSet> & { code: string }
    ): Pick<MetadataPayload, "dataSets" | "sections"> {
        const { project } = this;
        const dataSetId = getUid("dataSet", project.uid + baseDataSet.code);

        const dataElements = project.dataElements.get({ onlySelected: true, includePaired: true });

        const dataElementsInSectors = _(dataElements)
            .filter(de => project.sectors.some(sector => sector.id === de.sectorId))
            .uniqBy(de => de.id)
            .value();

        const dataSetElements = dataElementsInSectors.map(dataElement => ({
            dataSet: { id: dataSetId },
            dataElement: { id: dataElement.id },
            categoryCombo: { id: dataElement.categoryComboId },
        }));

        const sections = project.sectors.map((sector, index) => {
            return {
                id: getUid("section", project.uid + baseDataSet.code + sector.id),
                dataSet: { id: dataSetId },
                sortOrder: index,
                name: sector.displayName,
                dataElements: dataElements
                    .filter(de => de.sectorId === sector.id)
                    .map(de => ({ id: de.id })),
                greyedFields: [],
            };
        });

        const dataSet = {
            id: dataSetId,
            description: project.description,
            periodType: "Monthly",
            dataElementDecoration: true,
            renderAsTabs: true,
            categoryCombo: { id: project.config.categoryCombos.targetActual.id },
            organisationUnits: [{ id: orgUnit.id }],
            dataSetElements,
            timelyDays: 0,
            formType: "DEFAULT" as const,
            sections: sections.map(section => ({ id: section.id })),
            ...baseDataSet,
            code: `${orgUnit.id}_${baseDataSet.code}`,
        };

        return { dataSets: [dataSet], sections };
    }
}

function getDataSetPeriods(startDate: moment.Moment, endDate: moment.Moment) {
    const projectOpeningDate = startDate;
    const projectClosingDate = startDate.clone().add(1, "month");

    const targetPeriods = getMonthsRange(startDate, endDate).map(date => ({
        period: { id: date.format("YYYYMM") },
        openingDate: toISOString(projectOpeningDate),
        closingDate: toISOString(projectClosingDate),
    }));

    const actualPeriods = getMonthsRange(startDate, endDate).map(date => ({
        period: { id: date.format("YYYYMM") },
        openingDate: toISOString(date.clone().startOf("month")),
        closingDate: toISOString(
            date
                .clone()
                .startOf("month")
                .add(1, "month")
                .date(expiryDaysInMonthActual)
        ),
    }));

    return { targetPeriods, actualPeriods };
}

function getOrgUnitId(orgUnit: { path: string }): string {
    const id = _.last(orgUnit.path.split("/"));
    if (id) return id;
    else throw new Error(`Invalid path: ${orgUnit.path}`);
}

function addAttributeValue<Attribute extends Ref>(
    attributeValues: Array<{ attribute: Ref; value: string }>,
    attribute: Attribute,
    value: string
) {
    return attributeValues.concat([{ value, attribute: { id: attribute.id } }]);
}

export function flattenPayloads<Model extends keyof MetadataPayload>(
    payloads: Array<Partial<Pick<MetadataPayload, Model>>>
): Pick<MetadataPayload, Model> {
    const concat = <T>(value1: T[] | undefined, value2: T[]): T[] => (value1 || []).concat(value2);
    const payload = payloads.reduce(
        (payloadAcc, payload) => _.mergeWith(payloadAcc, payload, concat),
        {} as Pick<MetadataPayload, Model>
    );
    return payload as Pick<MetadataPayload, Model>;
}
