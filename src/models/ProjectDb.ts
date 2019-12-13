import _ from "lodash";
import moment from "moment";
import { generateUid } from "d2/uid";
import { D2DataSet, D2OrganisationUnit, D2ApiResponse, Id } from "d2-api";
import { PartialModel, Ref, PartialMetadata, MetadataResponse } from "d2-api";
import Project from "./Project";
import { getMonthsRange, toISOString } from "../utils/date";
import "../utils/lodash-mixins";

const expiryDaysInMonthActual = 10;

function getOrgUnitId(orgUnit: { path: string }): string {
    const id = _.last(orgUnit.path.split("/"));
    if (id) return id;
    else throw new Error(`Invalid path: ${orgUnit.path}`);
}

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
        const parentOrgUnit = project.organisationUnit;

        if (!startDate || !endDate) {
            throw new Error("Missing dates");
        } else if (!parentOrgUnit) {
            throw new Error("No parent org unit");
        }

        const baseAttributeValues = [
            { value: "true", attribute: { id: config.attributes.createdByApp.id } },
        ];

        const dashboard = { id: generateUid(), name: project.name };

        const parentOrgUnitId = getOrgUnitId(parentOrgUnit);
        const orgUnit = {
            id: generateUid(),
            name: project.name,
            code: project.code,
            shortName: project.shortName,
            description: project.description,
            parent: { id: parentOrgUnitId },
            openingDate: toISOString(startDate.clone().subtract(1, "month")),
            closedDate: toISOString(endDate.clone().add(1, "month")),
            organisationUnitGroups: project.funders.map(funder => ({ id: funder.id })),
            attributeValues: [
                ...baseAttributeValues,
                {
                    value: dashboard.id,
                    attribute: { id: config.attributes.projectDashboard.id },
                },
            ],
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

        const dataSetAttributeValues = [
            ...baseAttributeValues,
            {
                value: orgUnit.id,
                attribute: { id: config.attributes.orgUnitProject.id },
            },
        ];

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

        const baseMetadata = {
            organisationUnits: [orgUnit],
            organisationUnitGroups: newOrgUnitGroupFunders,
            dashboards: [dashboard],
        };

        const payload = flattenPayloads([
            baseMetadata,
            dataSetTargetMetadata,
            dataSetActualMetadata,
        ]);

        await this.saveMERData(orgUnit.id).getData();

        const response = await api.metadata.post(payload).getData();

        return { orgUnit, payload, response, project: this.project };
    }

    saveMERData(orgUnitId: Id): D2ApiResponse<void> {
        const dataStore = this.project.api.dataStore("project-monitoring-app");
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
        orgUnit: Ref & PartialModel<D2OrganisationUnit>
    ) {
        if (response.status === "OK") {
            await this.project.api.models.organisationUnits
                .put(orgUnit)
                .getData()
                .then(() => true)
                .catch(() => false);
        }
    }

    getDataSetsMetadata(
        orgUnit: { id: string },
        baseDataSet: PartialModel<D2DataSet>
    ): PartialMetadata {
        const { project } = this;
        const dataSetId = generateUid();

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
                id: generateUid(),
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
            code: baseDataSet.code ? `${orgUnit.id}_${baseDataSet.code}` : undefined,
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

/* Accumulate Array<{key1: [...], key2: [...]}> into {key1: [...], key2: [...]} */
export function flattenPayloads(payloads: object[]): object {
    return _(payloads)
        .map(_.toPairs)
        .flatten()
        .groupBy(([key, _values]) => key)
        .mapValues(pairs =>
            _(pairs)
                .flatMap(([_key, values]) => values)
                .uniqBy("id")
                .map(obj => _.omitBy(obj, (_v, k) => k === "key" || k.startsWith("$")))
                .value()
        )
        .value();
}
