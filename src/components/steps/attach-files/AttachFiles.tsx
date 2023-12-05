import React from "react";
import _ from "lodash";
import styled from "styled-components";
import { IconButton, makeStyles, Typography } from "@material-ui/core";
import CloudDownload from "@material-ui/icons/CloudDownload";
import DeleteIcon from "@material-ui/icons/DeleteRounded";

import Project from "../../../models/Project";
import { ProjectDocument } from "../../../models/ProjectDocument";
import { DropFiles } from "./DropFiles";

import i18n from "./../../../locales";

type AttachFilesProps = {
    project: Project;
    onChange: (documents: ProjectDocument[]) => void;
};

export const AttachFiles: React.FC<AttachFilesProps> = props => {
    const classes = useStyles();
    const { onChange, project } = props;
    const [documents, setDocuments] = React.useState<ProjectDocument[]>(project.documents);

    const addFile = async (files: File[]) => {
        const file = _(files).first();
        if (!file) return false;
        const base64 = await blobToBase64(file);
        const newFile = ProjectDocument.create({
            blob: file,
            id: "",
            name: file.name,
            sizeInBytes: file.size,
            href: base64,
            url: undefined,
            sharing: undefined,
            markAsDeleted: false,
        });
        const prevDocuments = [...documents];
        const newDocuments = [...prevDocuments, { ...newFile, base64 }];
        onChange(newDocuments);
        setDocuments(newDocuments);
    };

    const onDeleteDocument = (index: number) => {
        const documentsWithoutDeleted = documents.map((document, docIndex) => {
            return ProjectDocument.create({
                ...document,
                markAsDeleted: document.markAsDeleted ? document.markAsDeleted : docIndex === index,
            });
        });
        onChange(documentsWithoutDeleted);
        setDocuments(documentsWithoutDeleted);
    };

    const updateDocument = async (files: File[], index: number) => {
        const file = _(files).first();
        if (!file) return false;
        const base64 = await blobToBase64(file);
        const newDocuments = documents.map((document, docIndex) => {
            return docIndex !== index
                ? document
                : ProjectDocument.create({
                      ...document,
                      name: file.name,
                      blob: file,
                      sizeInBytes: file.size,
                      href: base64,
                      markAsDeleted: false,
                  });
        });
        onChange(newDocuments);
        setDocuments(newDocuments);
    };

    return (
        <div>
            <DropNewFileContainer>
                <DropFiles
                    onDrop={addFile}
                    label={i18n.t("Drag and Drop Files (Maximum 5MB per file)")}
                />
            </DropNewFileContainer>

            <DocumentsItemsContainer>
                {documents.length > 0 && (
                    <Typography className={classes.title} variant="body1">
                        {i18n.t("Attached Files")}:
                    </Typography>
                )}
                {documents.map((document, index) => {
                    return (
                        <DocumentItemContainer key={index} deleted={document.markAsDeleted}>
                            <DocumentDropZoneContainer>
                                <DropFiles
                                    onDrop={files => updateDocument(files, index)}
                                    label={document.name}
                                />
                            </DocumentDropZoneContainer>
                            <a download={document.name} href={document.href}>
                                <IconButton color="primary" aria-label={i18n.t("Download")}>
                                    <CloudDownload fontSize="large" />
                                </IconButton>
                            </a>
                            <IconButton
                                onClick={() => onDeleteDocument(index)}
                                aria-label={i18n.t("Delete")}
                            >
                                <DeleteIcon fontSize="large" />
                            </IconButton>
                        </DocumentItemContainer>
                    );
                })}
            </DocumentsItemsContainer>
        </div>
    );
};

function blobToBase64(blob: Blob): Promise<Base64> {
    return new Promise((resolve: (value: Base64) => void, reject: (reason?: any) => void) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            reader.result ? resolve(reader.result as Base64) : reject("Error");
        };
        reader.onerror = () => {
            reject(reader.error);
        };
        reader.readAsDataURL(blob);
    });
}

const DropNewFileContainer = styled.div`
    padding: 30px;
    max-width: 800px;
    margin: 0 auto;
`;

const DocumentsItemsContainer = styled.div`
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 1em;
`;

const DocumentItemContainer = styled.div<{ deleted: boolean }>`
    align-items: center;
    display: ${props => (props.deleted ? "none" : "flex")};
    gap: 2em;
`;

const DocumentDropZoneContainer = styled.div`
    width: 600px;
`;

const useStyles = makeStyles({
    title: {
        fontSize: "1.5rem",
    },
});

type Base64 = string;
