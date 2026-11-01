"use client";

import { useEffect } from "react";
import { detectTimezone } from "@/app/actions";

const KEY = "nowlanding:tz-detected";

/** Renders nothing. Once per browser, saves the detected time zone while the profile is still on the UTC default. */
export function TimezoneDetect() {
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) return;
      localStorage.setItem(KEY, "1");
    } catch {
      // storage blocked: still try once per page load
    }
    void detectTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);
  return null;
}
