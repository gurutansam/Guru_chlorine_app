import React from "react";
import BaseLayout from "../../SharedLayout/BaseLayout";

const DashboardLayout = ({ children }) => (
  <BaseLayout role="chlorination-admin">{children}</BaseLayout>
);
export default DashboardLayout;