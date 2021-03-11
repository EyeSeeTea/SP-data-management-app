import { useHistory } from "react-router-dom";

export function useAppHistory() {
    const history = useHistory();
    return { goBack: history.goBack };
}
