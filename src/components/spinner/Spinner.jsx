import React from "react";
import PropTypes from "prop-types";
import CircularProgress from "@material-ui/core/CircularProgress";

class Spinner extends React.Component {
    static propTypes = {
        isLoading: PropTypes.bool.isRequired,
    };

    render() {
        const { isLoading } = this.props;
        return isLoading ? <CircularProgress style={style} /> : null;
    }
}

const style = {
    marginLeft: "48%",
};

export default React.memo(Spinner);
