import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // exceljs Node modullariga tayanadi — bundlega qo'shilmasin
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
