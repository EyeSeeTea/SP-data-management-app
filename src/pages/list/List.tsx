import React from "react";
import { ListView } from "../../components/list-selector/ListSelector";
import ProjectsList from "../projects-list/ProjectsList";
import CountriesList from "../../components/countries-list/CountriesList";

interface ListProps {}

const List: React.FunctionComponent<ListProps> = () => {
    const [view, setView] = React.useState<ListView>("projects"); // TODO: change to projects
    return (
        <div>
            {view === "projects" ? (
                <ProjectsList onViewChange={setView} />
            ) : (
                <CountriesList onViewChange={setView} />
            )}
        </div>
    );
};

export default List;
