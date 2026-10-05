import React from "react";
import BaseLayout from "../SharedLayout/BaseLayout";

const DashboardLayout = ({ children }) => (
  <BaseLayout role="mosquito-admin">{children}</BaseLayout>
);
export default DashboardLayout;