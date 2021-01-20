import { Config, Sector as SectorC, Funder as FunderC, Location as LocationC } from "./Config";
import moment, { Moment } from "moment";
import _ from "lodash";
import { D2Api, Id, Ref } from "../types/d2-api";
import { D2OrganisationUnit } from "../types/d2-api";
// @ts-ignore
import { generateUid } from "d2/uid";
import { TableSorting } from "d2-ui-components";

import i18n from "../locales";
import DataElementsSet, { PeopleOrBenefit, DataElement, SelectionInfo } from "./dataElementsSet";
import ProjectDb from "./ProjectDb";
import { toISOString, getMonthsRange } from "../utils/date";
import ProjectDownload from "./ProjectDownload";
import ProjectList, { ProjectForList, FiltersForList } from "./ProjectsList";
import ProjectDataSet from "./ProjectDataSet";
import ProjectDelete from "./ProjectDelete";
import {
    validatePresence,
    validateRegexp,
    validateNumber,
    validateNonEmpty,
} from "../utils/validations";
import { getKeys, Maybe } from "../types/utils";
import ProjectSharing from "./ProjectSharing";
import { Disaggregation, SetCovid19WithRelationsOptions } from "./Disaggregation";
import { Sharing } from "./Sharing";

/*
Project model.

* Get an existing project:

    const existingProject = await Project.get(d2Api, "gr7Fzf5l9F2");

* Create a new project, set fields and validate:

    const project = Project.create(d2Api);
    const projectWithNameAndDescription = project
        .set("name", "Project Name")
        .set("description", "Some description")

    projectWithNameAndDescription.name
    # "Project Name"

    # Also:

    const projectWithNameAndDescription = project.setObj({
        name: "Project Name",
        description: "Some description",
    });

    const errors = await projectWithNameAndDescription.validate(["name", "description"])
    # {name: [], description: []}

    const errors = await projectWithNameAndDescription.validate()
    # {
        "name": [],
        "startDate": [
            "Start Date cannot be blank"
        ],
        ...
      }


* Get paginated list of projects:

    const { objects, pager } = await Project.getList(
        api,
        config,
        { search: "abc", createdByCurrentUser: true },
        { field: "displayName", order: "desc" },
        { page: 2, pageSize: 10 }
    )
*/

export type Sector = SectorC;
export type Funder = FunderC;
export type Location = Omit<LocationC, "countries">;

export interface ProjectData {
    id: Id;
    created: Moment | undefined;
    name: string;
    description: string;
    awardNumber: string;
    subsequentLettering: string;
    additional: string;
    startDate: Moment | undefined;
    endDate: Moment | undefined;
    sectors: Sector[];
    funders: Funder[];
    locations: Location[];
    orgUnit: OrganisationUnit | undefined;
    parentOrgUnit: OrganisationUnit | undefined;
    dataElementsSelection: DataElementsSet;
    dataElementsMER: DataElementsSet;
    disaggregation: Disaggregation;
    dataSets: { actual: DataSet; target: DataSet } | undefined;
    dashboard: Partial<Dashboards>;
    initialData: Omit<ProjectData, "initialData"> | undefined;
    sharing: Sharing;
}

export interface Dashboard {
    id: Id;
    name: string;
}

export type Dashboards = Record<"project" | "country" | "awardNumber", Dashboard | undefined>;

export interface DataInputPeriod {
    period: { id: string };
    openingDate: string;
    closingDate: string;
}

export const dataSetTypes = ["actual", "target"] as const;
export type DataSetType = typeof dataSetTypes[number];

export interface DataSet {
    id: string;
    code: string;
    dataSetElements: Array<{ dataElement: Ref; categoryCombo: Ref }>;
    sections: Array<{ code: string }>;
    dataInputPeriods: DataInputPeriod[];
    openFuturePeriods: number;
    expiryDays: number;
}

export interface OrganisationUnit {
    id: string;
    path: string;
    displayName: string;
}

export const monthFormat = "YYYYMM";

const defaultProjectData = {
    id: undefined,
    created: undefined,
    name: "",
    description: "",
    awardNumber: "",
    subsequentLettering: "",
    additional: "",
    startDate: undefined,
    endDate: undefined,
    sectors: [],
    funders: [],
    locations: [],
    orgUnit: undefined,
    parentOrgUnit: undefined,
    dataSets: undefined,
    dashboard: {},
};

function defineGetters(sourceObject: any, targetObject: any) {
    Object.keys(sourceObject).forEach(function(key) {
        Object.defineProperty(targetObject, key, {
            get: () => sourceObject[key],
            enumerable: true,
            configurable: true,
        });
    });
}

const validationKeys = [
    ...getKeys(defaultProjectData),
    "code" as const,
    "dataElementsSelection" as const,
    "dataElementsMER" as const,
];

export type ProjectField = keyof ProjectData;
export type ValidationKey = typeof validationKeys[number];
type Validation = () => ValidationError | Promise<ValidationError>;
type ValidationError = string[];
type Validations = { [K in ValidationKey]?: Validation };

class Project {
    data: ProjectData;
    dataSetsByType: Record<DataSetType, ProjectDataSet>;

    static lengths = {
        awardNumber: 5,
        additional: 40,
    };

    static formats() {
        return {
            subsequentLettering: {
                regexp: /^[a-zA-Z]{2}$/,
                msg: i18n.t("Subsequent Lettering must contain exactly two letters"),
            },
        };
    }

    static fieldNames: Record<ProjectField, string> = {
        id: i18n.t("Id"),
        created: i18n.t("Created"),
        name: i18n.t("Name"),
        dataElementsSelection: i18n.t("Data Elements Selection"),
        dataElementsMER: i18n.t("Data Elements MER"),
        disaggregation: i18n.t("Disaggregation"),
        description: i18n.t("Description"),
        awardNumber: i18n.t("Award Number"),
        subsequentLettering: i18n.t("Subsequent Lettering"),
        additional: i18n.t("Additional Designation"),
        startDate: i18n.t("Start Date"),
        endDate: i18n.t("End Date"),
        sectors: i18n.t("Sectors"),
        funders: i18n.t("Funders"),
        locations: i18n.t("Project Locations"),
        orgUnit: i18n.t("Organisation Unit"),
        parentOrgUnit: i18n.t("Country"),
        dataSets: i18n.t("Data Sets"),
        dashboard: i18n.t("Dashboard"),
        initialData: i18n.t("Initial Data"),
        sharing: i18n.t("Sharing"),
    };

    static getFieldName(field: ProjectField): string {
        return this.fieldNames[field];
    }

    f(field: ProjectField): string {
        return Project.getFieldName(field);
    }

    validations: Validations = {
        name: () => validatePresence(this.name, this.f("name")),
        startDate: () => validatePresence(this.startDate, this.f("startDate")),
        endDate: () => validatePresence(this.endDate, this.f("endDate")),
        code: () => this.validateCodeUniqueness(),
        awardNumber: () =>
            validateRegexp(
                this.awardNumber,
                this.f("awardNumber"),
                new RegExp(`^\\d{${Project.lengths.awardNumber}}$`),
                i18n.t("Award Number should be a number of 5 digits")
            ),
        subsequentLettering: () =>
            validateRegexp(
                this.subsequentLettering,
                this.f("subsequentLettering"),
                Project.formats().subsequentLettering.regexp,
                Project.formats().subsequentLettering.msg
            ),
        additional: () =>
            validateNumber(this.additional.length, this.f("additional"), {
                max: Project.lengths.additional,
            }),
        sectors: () => validateNonEmpty(this.sectors, this.f("sectors")),
        funders: () => validateNonEmpty(this.funders, this.f("funders")),
        locations: () => validateNonEmpty(this.locations, this.f("locations")),
        parentOrgUnit: () =>
            this.parentOrgUnit ? [] : [i18n.t("One Organisation Unit should be selected")],
        dataElementsSelection: () =>
            this.dataElementsSelection.validateAtLeastOneItemPerSector(this.sectors),
        dataElementsMER: () => this.dataElementsMER.validatetOneItemTotal(this.sectors),
    };

    static requiredFields: Set<ProjectField> = new Set([
        "name",
        "startDate",
        "endDate",
        "awardNumber",
        "subsequentLettering",
        "sectors",
        "funders",
        "locations",
        "parentOrgUnit",
        "dataElementsSelection",
        "dataElementsMER",
    ]);

    constructor(public api: D2Api, public config: Config, rawData: ProjectData) {
        this.data = Project.processInitialData(config, rawData);
        defineGetters(this.data, this);
        this.dataSetsByType = {
            actual: new ProjectDataSet(this, "actual"),
            target: new ProjectDataSet(this, "target"),
        };
    }

    static processInitialData(config: Config, data: ProjectData) {
        return {
            ...data,
            locations: _.intersectionBy(
                data.locations,
                Project.getSelectableLocations(config, data.parentOrgUnit),
                "id"
            ),
        };
    }

    static isFieldRequired(field: ProjectField) {
        return Project.requiredFields.has(field);
    }

    public set<K extends keyof ProjectData>(field: K, value: ProjectData[K]): Project {
        return new Project(this.api, this.config, { ...this.data, [field]: value });
    }

    public setObj<K extends keyof ProjectData>(obj: Pick<ProjectData, K>): Project {
        return new Project(this.api, this.config, { ...this.data, ...obj });
    }

    public get shortName(): string {
        return this.data.name.slice(0, 50);
    }

    public get code(): string {
        return _([
            this.awardNumber,
            this.subsequentLettering,
            this.additional ? "-" + this.additional : null,
        ])
            .compact()
            .join("");
    }

    public getSelectedDataElements(
        filter: { peopleOrBenefit?: PeopleOrBenefit } = {}
    ): DataElement[] {
        const { dataElementsSelection, sectors } = this.data;
        const sectorIds = new Set(sectors.map(sector => sector.id));
        const selectedDataElements = _(
            dataElementsSelection.get({ onlySelected: true, includePaired: true, ...filter })
        )
            .filter(de => sectorIds.has(de.sector.id))
            .uniqBy(de => de.id)
            .value();

        const orderBySectorId: _.Dictionary<string> = _(sectors)
            .map((sector, idx) => [sector.id, idx])
            .fromPairs()
            .value();

        const selectedDataElementsSorted = _.orderBy(
            selectedDataElements,
            [de => orderBySectorId[de.sector.id], de => de.name],
            ["asc", "asc"]
        );
        return selectedDataElementsSorted;
    }

    public getSectorsInfo(): Array<{
        sector: Sector;
        dataElementsInfo: Array<{
            dataElement: DataElement;
            isMER: boolean;
            isCovid19: boolean;
            usedInDataSetSection: boolean;
        }>;
    }> {
        const { dataElementsSelection, dataElementsMER, sectors } = this;
        const dataElementsBySectorMapping = new ProjectDb(this).getDataElementsBySectorMapping();
        const selectedMER = new Set(dataElementsMER.get({ onlySelected: true }).map(de => de.id));

        return sectors.map(sector => {
            const getOptions = { onlySelected: true, includePaired: true, sectorId: sector.id };
            const dataElements = _.sortBy(dataElementsSelection.get(getOptions), de => de.name);
            const dataElementsInfo = dataElements.map(dataElement => ({
                dataElement,
                isMER: selectedMER.has(dataElement.id),
                isCovid19: this.disaggregation.isCovid19(dataElement.id),
                usedInDataSetSection: dataElementsBySectorMapping[dataElement.id] === sector.id,
            }));

            return { sector, dataElementsInfo };
        });
    }

    public async validate(
        keysToValidate: Maybe<ValidationKey[]> = undefined
    ): Promise<Record<ValidationKey, string[]>> {
        const errors = {} as Record<ValidationKey, string[]>;
        const keys = keysToValidate || validationKeys;
        for (const key of keys) {
            const fn = this.validations[key];
            if (fn) {
                const fnErrors = await fn();
                errors[key] = fnErrors;
            }
        }
        return errors;
    }

    static getSelectableLocations(config: Config, country: Ref | undefined) {
        return config.locations.filter(
            location =>
                country && _.some(location.countries, country_ => country_.id === country.id)
        );
    }

    getSelectableLocations(country: Ref | undefined) {
        return Project.getSelectableLocations(this.config, country);
    }

    setCountry(country: OrganisationUnit) {
        return this.setObj({
            parentOrgUnit: country,
            sharing: new ProjectSharing(this.config, this).getUpdatedSharingForCountry(country),
        });
    }

    static async get(api: D2Api, config: Config, id: string): Promise<Project> {
        return ProjectDb.get(api, config, id);
    }

    static create(api: D2Api, config: Config) {
        const dataElementsSelection = DataElementsSet.build(config, { groupPaired: true });
        const dataElementsMER = DataElementsSet.build(config, {
            groupPaired: false,
            superSet: dataElementsSelection,
        });
        const projectData = {
            ...defaultProjectData,
            id: generateUid(),
            dataElementsSelection,
            dataElementsMER,
            disaggregation: Disaggregation.buildFromDataSetElements(config, []),
            sharing: ProjectSharing.getInitialSharing(config),
            initialData: undefined,
        };
        return new Project(api, config, projectData);
    }

    download() {
        return new ProjectDownload(this).generate();
    }

    save() {
        return new ProjectDb(this).save();
    }

    static async getList(
        api: D2Api,
        config: Config,
        filters: FiltersForList,
        sorting: TableSorting<ProjectForList>,
        pagination: { page: number; pageSize: number }
    ) {
        const projectsList = new ProjectList(api, config);
        return projectsList.get(filters, sorting, pagination);
    }

    setSectors(sectors: Sector[]): Project {
        return this.setObj({
            sectors: sectors,
            dataElementsSelection: this.data.dataElementsSelection.keepSelectionInSectors(sectors),
        });
    }

    updateDataElementsSelection(sectorId: string, dataElementIds: string[]) {
        const { dataElementsSelection, dataElementsMER, sectors } = this.data;
        const res = dataElementsSelection.updateSelectedWithRelations({ sectorId, dataElementIds });
        const { dataElements: dataElementsUpdate, selectionInfo } = res;

        const sectorIdsCurrent = sectors.map(sector => sector.id);
        const sectorIdsWithSelected = _(dataElementsUpdate.get({ onlySelected: true }))
            .map(de => de.sector.id)
            .concat(sectors.map(sector => sector.id))
            .uniq()
            .value();
        const newSectorIds = _.difference(sectorIdsWithSelected, sectorIdsCurrent);
        const newSectors = _(this.config.sectors)
            .keyBy(sector => sector.id)
            .at([...sectorIdsCurrent, ...newSectorIds])
            .value();
        const newProject = this.setObj({
            sectors: newSectors,
            dataElementsSelection: dataElementsUpdate,
            dataElementsMER: dataElementsMER.updateSuperSet(dataElementsUpdate),
        });
        return { selectionInfo, project: newProject };
    }

    updateDataElementsMERSelection(sectorId: string, dataElementIds: string[]) {
        const { dataElementsMER } = this.data;
        const newDataElementsMER = dataElementsMER.updateSelected({ [sectorId]: dataElementIds });
        const newProject = this.setObj({ dataElementsMER: newDataElementsMER });
        return { selectionInfo: {}, project: newProject };
    }

    public get uid() {
        return this.id;
    }

    async validateCodeUniqueness(): Promise<ValidationError> {
        const { api, code } = this;
        if (!code) return [];
        const { organisationUnits } = await api.metadata
            .get({
                organisationUnits: {
                    fields: { displayName: true },
                    filter: { code: { eq: code }, id: { ne: this.id } },
                },
            })
            .getData();
        const orgUnit = organisationUnits[0];
        return orgUnit
            ? [
                  i18n.t("There is a project with the same code '{{code}}' -> {{orgUnit}}", {
                      code,
                      orgUnit: orgUnit.displayName,
                  }),
              ]
            : [];
    }

    getPeriods(options: { toDate?: boolean } = {}): Array<{ date: Moment; id: string }> {
        const { startDate, endDate } = this;
        const { toDate = false } = options;
        const months = getMonthsRange(startDate, endDate);
        const periods = months.map(date => ({ date, id: date.format("YYYYMM") }));
        const now = moment();
        return !toDate ? periods : periods.filter(period => period.date <= now);
    }

    getDates(): { startDate: Moment; endDate: Moment } {
        const { startDate, endDate } = this;
        if (!startDate || !endDate) throw new Error("No project dates");
        return { startDate, endDate };
    }

    getProjectDataSet(dataSet: DataSet) {
        const dataSetType: DataSetType = dataSet.code.endsWith("ACTUAL") ? "actual" : "target";
        return this.dataSetsByType[dataSetType];
    }

    static async delete(config: Config, api: D2Api, ids: Id[]): Promise<void> {
        return new ProjectDelete(config, api).delete(ids);
    }

    setCovid19(
        options: SetCovid19WithRelationsOptions
    ): { selectionInfo: SelectionInfo; project: Project } {
        const res = this.disaggregation.setCovid19WithRelations(options);
        const { selectionInfo, disaggregation: newDisaggregation } = res;
        const newProject = this.setObj({ disaggregation: newDisaggregation });
        return { selectionInfo, project: newProject };
    }
}

interface Project extends ProjectData {}

type OrgUnitWithDates = Pick<D2OrganisationUnit, "openingDate" | "closedDate">;

export function getDatesFromOrgUnit<OU extends OrgUnitWithDates>(
    orgUnit: OU
): { startDate: Moment | undefined; endDate: Moment | undefined } {
    const process = (s: string | undefined, mapper: (d: Moment) => Moment) =>
        s ? mapper(moment(s)) : undefined;
    return {
        startDate: process(orgUnit.openingDate, d => d.add(1, "month")),
        endDate: process(orgUnit.closedDate, d => d.subtract(1, "month").endOf("month")),
    };
}

export function getProjectFromOrgUnit<OU extends OrgUnitWithDates>(orgUnit: OU): OU {
    const { startDate, endDate } = getDatesFromOrgUnit(orgUnit);

    return {
        ...orgUnit,
        ...(startDate ? { openingDate: toISOString(startDate) } : {}),
        ...(endDate ? { closedDate: toISOString(endDate) } : {}),
    };
}

export function getOrgUnitDatesFromProject(startDate: Moment, endDate: Moment): OrgUnitWithDates {
    return {
        openingDate: toISOString(
            startDate
                .clone()
                .subtract(1, "month")
                .startOf("day")
        ),
        closedDate: toISOString(
            endDate
                .clone()
                .add(1, "month")
                .endOf("month")
                .startOf("day")
        ),
    };
}

function getPeriodIds(dataSet: DataSet): string[] {
    return _(dataSet.dataInputPeriods)
        .map(dip => dip.period.id)
        .sortBy()
        .value();
}

export function getPeriodsData(dataSet: DataSet) {
    const periodIds = getPeriodIds(dataSet);
    const isTarget = dataSet.code.endsWith("TARGET");
    let currentPeriodId;

    if (isTarget) {
        currentPeriodId = _.first(periodIds);
    } else {
        const nowPeriodId = moment().format(monthFormat);
        currentPeriodId = periodIds.includes(nowPeriodId) ? nowPeriodId : _.last(periodIds);
    }

    return { periodIds, currentPeriodId };
}

export default Project;
