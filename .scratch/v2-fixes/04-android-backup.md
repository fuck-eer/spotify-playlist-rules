# F04: Android backup and token store (S2)
**Status:** ready-for-agent
allowBackup=false plus dataExtractionRules/fullBackupContent excluding the token prefs and cache. EncryptedTokenStore: on create failure delete prefs and start signed out. Test.
