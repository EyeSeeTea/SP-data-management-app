import React from "react";
import { useHistory } from "react-router-dom";
import { useLastLocation } from "react-router-last-location";

export function useAppHistory(defaultBackUrl: string) {
    const history = useHistory();
    const lastLocation = useLastLocation();

    const goBackOrToDefaultUrlIfOriginOutsideApp = React.useCallback(() => {
        if (lastLocation) {
            history.goBack();
        } else {
            history.push(defaultBackUrl);
        }
    }, [defaultBackUrl, history, lastLocation]);

    return { goBack: goBackOrToDefaultUrlIfOriginOutsideApp };
}
