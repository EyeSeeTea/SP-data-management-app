import React from "react";
import { useSnackbar } from "@eyeseetea/d2-ui-components";
import styled from "styled-components";
import { useDropzone } from "react-dropzone";
import CloudUploadIcon from "@material-ui/icons/CloudUpload";
import _ from "lodash";

import { MAX_SIZE_IN_MB, ProjectDocument } from "../../../models/ProjectDocument";
import i18n from "../../../locales";

export const DropFiles: React.FC<DropFilesProps> = props => {
    const snackbar = useSnackbar();
    const { getRootProps, getInputProps, fileRejections } = useDropzone({
        onDrop: props.onDrop,
        validator: (file: File) => {
            const isValid = ProjectDocument.isValidSize(file.size);
            if (isValid) {
                return null;
            } else {
                return {
                    code: "size-too-large",
                    message: i18n.t("File is larger than {{maxSizeInMb}}MB", {
                        maxSizeInMb: MAX_SIZE_IN_MB,
                    }),
                };
            }
        },
    });

    React.useEffect(() => {
        if (fileRejections.length > 0) {
            const fileRejection = _(fileRejections).first();
            if (fileRejection) {
                snackbar.error(
                    `${fileRejection.file.name}: ${fileRejection.errors
                        .map(error => error.message)
                        .join(",")}`
                );
            }
        }
    }, [fileRejections, snackbar]);

    return (
        <DropFileContainer className="container">
            <div {...getRootProps({ className: "dropzone" })}>
                <input {...getInputProps()} />
                <p className="label">{props.label}</p>
                <CloudUploadIcon />
            </div>
        </DropFileContainer>
    );
};

const DropFileContainer = styled.div`
    background: #f0f0f0;
    border: 1px dashed #c8c8c8;
    cursor: pointer;

    .dropzone {
        align-items: center;
        display: flex;
        gap: 1em;
        justify-content: center;
        padding: 0 1em;

        .label {
            overflow: hidden;
            text-overflow: ellipsis;
            text-wrap: nowrap;
        }
    }
`;

type DropFilesProps = {
    onDrop: (files: File[]) => void;
    label: string;
};
