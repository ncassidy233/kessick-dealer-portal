import { createContext, useContext } from "react";
import type { StaffDealerView } from "./staff-dealer-view";

export const StaffDealerViewContext = createContext<StaffDealerView | null>(null);
export const useStaffDealerView = () => useContext(StaffDealerViewContext);
