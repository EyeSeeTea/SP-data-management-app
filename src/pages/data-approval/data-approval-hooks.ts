import React from "react";
import { User } from "./DataApprovalMessage";
import { DataEntry } from "../../models/DataEntry";
import { Maybe } from "../../types/utils";
import { useAppContext } from "../../contexts/api-context";
import Project from "../../models/Project";

export function useDialog() {
    const [isOpen, setOpen] = React.useState(false);
    const open = React.useCallback(() => setOpen(true), [setOpen]);
    const close = React.useCallback(() => setOpen(false), [setOpen]);
    return { isOpen, open, close };
}

interface DataApprovalMessageHook {
    onSend(users: User[], body: string): Promise<void>;
    users: Maybe<User[]>;
}

export function useDataApprovalMessage(
    project: Maybe<Project>,
    dataSetType: Maybe<"actual" | "target">,
    period: Maybe<string>
): DataApprovalMessageHook {
    const { api } = useAppContext();

    const [users, setUsers] = React.useState<User[] | undefined>();
    React.useEffect(() => {
        if (dataSetType && period && project) {
            new DataEntry(api, project, dataSetType, period).getEntryUsers().then(setUsers);
        }
    }, [api, project, period, dataSetType, setUsers]);

    const sendMessage = React.useCallback(
        async (users: User[], body: string) => {
            if (dataSetType && period && project) {
                new DataEntry(api, project, dataSetType, period).sendMessage(users, body);
            }
        },
        [dataSetType, period, project, api]
    );

    return { users, onSend: sendMessage };
}
