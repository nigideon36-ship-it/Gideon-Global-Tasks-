import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  EAST_AFRICA_COUNTRIES,
  EastAfricaCountry,
  detectEastAfricaFromTimezone,
  getCountryByCode,
  isEastAfricaCountryCode,
} from '../lib/eastAfrica';
import { useAuth } from './AuthContext';

interface RegionContextType {
  selectedCountry: EastAfricaCountry;
  setSelectedCountryCode: (code: EastAfricaCountry['code']) => void;
  detectedCountryCode: string | null;
  isBlocked: boolean;
  blockReason: string | null;
  selectorOpen: boolean;
  setSelectorOpen: (open: boolean) => void;
  markOutsideEastAfrica: () => void;
  confirmEastAfricaAccess: (code: EastAfricaCountry['code']) => Promise<boolean>;
}

const STORAGE_COUNTRY_KEY = 'gideon_ea_country_v1';
const STORAGE_OVERRIDE_KEY = 'gideon_ea_verified_v1';

const RegionContext = createContext<RegionContextType | undefined>(undefined);

export const RegionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isOwner } = useAuth();

  const [selectedCountry, setSelectedCountry] = useState<EastAfricaCountry>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_COUNTRY_KEY);
      if (saved && isEastAfricaCountryCode(saved)) {
        return getCountryByCode(saved);
      }
    } catch {}
    return detectEastAfricaFromTimezone() || EAST_AFRICA_COUNTRIES[0];
  });

  const [detectedCountryCode, setDetectedCountryCode] = useState<string | null>(null);
  const [blockedByServer, setBlockedByServer] = useState(false);
  const [blockedManually, setBlockedManually] = useState(false);
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);

  useEffect(() => {
    let hasVerifiedOverride = false;
    try {
      hasVerifiedOverride = localStorage.getItem(STORAGE_OVERRIDE_KEY) === 'true';
    } catch {}

    fetch('/api/region/status')
      .then((res) => res.json())
      .then((data) => {
        if (data?.detectedCountry) {
          setDetectedCountryCode(data.detectedCountry);
          if (isEastAfricaCountryCode(data.detectedCountry)) {
            const matched = getCountryByCode(data.detectedCountry);
            setSelectedCountry(matched);
            try {
              localStorage.setItem(STORAGE_COUNTRY_KEY, matched.code);
            } catch {}
          }
        }
        if (data?.blockedByHeader && !hasVerifiedOverride) {
          setBlockedByServer(true);
          setBlockReason(
            `Access restricted: Your network location (${data.detectedCountry}) is outside East Africa. Gideon Global Tasks is exclusively available in Kenya, Uganda, Tanzania, Rwanda, Burundi, South Sudan, Ethiopia, and Somalia.`
          );
        }
      })
      .catch(() => {
        // Non-blocking in offline/local checks
      });
  }, []);

  const setSelectedCountryCode = (code: EastAfricaCountry['code']) => {
    const country = getCountryByCode(code);
    setSelectedCountry(country);
    setBlockedManually(false);
    setBlockedByServer(false);
    setBlockReason(null);
    try {
      localStorage.setItem(STORAGE_COUNTRY_KEY, country.code);
      localStorage.setItem(STORAGE_OVERRIDE_KEY, 'true');
    } catch {}
  };

  const markOutsideEastAfrica = () => {
    setBlockedManually(true);
    setBlockReason(
      'You indicated you are accessing from outside East Africa. Gideon Global Tasks is exclusively available to residents in East African countries.'
    );
    setSelectorOpen(false);
  };

  const confirmEastAfricaAccess = async (code: EastAfricaCountry['code']): Promise<boolean> => {
    try {
      const res = await fetch('/api/region/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countryCode: code }),
      });
      if (!res.ok) return false;
      setSelectedCountryCode(code);
      setSelectorOpen(false);
      return true;
    } catch {
      setSelectedCountryCode(code);
      setSelectorOpen(false);
      return true;
    }
  };

  const isBlocked = !isOwner && (blockedByServer || blockedManually);

  return (
    <RegionContext.Provider
      value={{
        selectedCountry,
        setSelectedCountryCode,
        detectedCountryCode,
        isBlocked,
        blockReason,
        selectorOpen,
        setSelectorOpen,
        markOutsideEastAfrica,
        confirmEastAfricaAccess,
      }}
    >
      {children}
    </RegionContext.Provider>
  );
};

export const useRegion = () => {
  const ctx = useContext(RegionContext);
  if (!ctx) {
    throw new Error('useRegion must be used within a RegionProvider');
  }
  return ctx;
};
