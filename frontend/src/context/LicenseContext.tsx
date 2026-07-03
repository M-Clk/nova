import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiClient } from "../api/apiClient";

export interface LicenseInfo {
  isValid: boolean;
  customerName: string | null;
  expirationDate: string | null;
  maxUsers: number;
  allowedFeatures: string[];
  message: string;
}

interface LicenseContextValue {
  isLicenseValid: boolean;
  licenseInfo: LicenseInfo | null;
  isChecking: boolean;
  checkLicense: () => Promise<void>;
  activate: (key: string) => Promise<boolean>;
}

const LicenseContext = createContext<LicenseContextValue>({
  isLicenseValid: true,
  licenseInfo: null,
  isChecking: true,
  checkLicense: async () => {},
  activate: async () => false
});

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const [isLicenseValid, setIsLicenseValid] = useState(true);
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  const checkLicense = useCallback(async () => {
    try {
      const { data } = await apiClient.get<LicenseInfo>("/license/status");
      setIsLicenseValid(data.isValid);
      setLicenseInfo(data);
    } catch (err) {
      setIsLicenseValid(false);
    } finally {
      setIsChecking(false);
    }
  }, []);

  const activate = useCallback(async (key: string) => {
    try {
      await apiClient.post("/license/activate", { licenseKey: key });
      await checkLicense();
      return true;
    } catch (err) {
      return false;
    }
  }, [checkLicense]);

  useEffect(() => {
    checkLicense();

    const handleLicenseExpired = () => {
      setIsLicenseValid(false);
    };

    window.addEventListener("license-expired", handleLicenseExpired);
    return () => {
      window.removeEventListener("license-expired", handleLicenseExpired);
    };
  }, [checkLicense]);

  useEffect(() => {
    if (isLicenseValid && licenseInfo?.customerName) {
      document.title = `Nova - ${licenseInfo.customerName}`;
    } else {
      document.title = "Nova - [İşletme Adı]";
    }
  }, [licenseInfo, isLicenseValid]);

  return (
    <LicenseContext.Provider value={{ isLicenseValid, licenseInfo, isChecking, checkLicense, activate }}>
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicense() {
  return useContext(LicenseContext);
}
