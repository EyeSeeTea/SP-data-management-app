import _ from "lodash";
import { Maybe } from "../types/utils";
import { Sharing } from "./Sharing";

export const MAX_SIZE_IN_MB = 5;
export const MAX_SIZE_PROJECT_IN_MB = 100;
const MAX_SIZE_IN_BYTES = 1_000_000 * MAX_SIZE_IN_MB;
const MAX_SIZE_PROJECT_IN_BYTES = 1_000_000 * MAX_SIZE_PROJECT_IN_MB;

export type Id = string;
type DocumentUrl = string;

export type ProjectAttrs = {
    id: Id;
    name: string;
    sizeInBytes: number;
    url: Maybe<Id>;
    href: DocumentUrl | undefined;
    blob: Maybe<Blob>;
    sharing: Maybe<Sharing>;
    markAsDeleted: boolean;
};

export class ProjectDocument {
    public readonly id: Id;
    public readonly name: string;
    public readonly url: Maybe<Id>;
    public readonly href: DocumentUrl | undefined;
    public readonly sizeInBytes: number;
    public readonly blob: Maybe<Blob>;
    public readonly sharing: Maybe<Sharing>;
    public readonly markAsDeleted: boolean;

    private constructor(data: ProjectAttrs) {
        this.id = data.id;
        this.name = data.name;
        this.url = data.url;
        this.href = data.href;
        this.sizeInBytes = data.sizeInBytes;
        this.blob = data.blob;
        this.sharing = data.sharing;
        this.markAsDeleted = data.markAsDeleted;
    }

    static create(data: ProjectDocument): ProjectDocument {
        return new ProjectDocument(data);
    }

    static isValidSize(size: number): boolean {
        return size <= MAX_SIZE_IN_BYTES;
    }

    static isProjectSizeValid(documents: ProjectDocument[]): boolean {
        const totalSize = _(documents).sumBy("sizeInBytes");
        return totalSize <= MAX_SIZE_PROJECT_IN_BYTES;
    }
}
