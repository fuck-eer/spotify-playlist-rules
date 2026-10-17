# F03: One arrangement save at a time (S1)
**Status:** done
Web promise chain / Android Mutex per Mix; each PUT uses the previous response's version and the latest local draft; no false 'Updated from another device.'; a failed save restores the last confirmed state. Test: two edits before the first response (web and Android).
