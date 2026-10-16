# Glossary

- **Rule**: a reusable, song-less intent in the global rule library: an action type plus its parameters (e.g. "play N times"). Gets a song only when added to a Mix. A Rule used by any Mix can't be deleted, only archived.
- **Mix**: a session: a Source playlist + a Rule Set + options (base order, seed), producing one Target playlist. Max rules set by MAX_RULES_PER_MIX (default 10, ADR-0017). One Target playlist per Mix (ADR-0015).
- **Rule Set**: the ordered list of Rules in a Mix, each bound to a song from the Source. Order = priority (earlier wins; see ADR-0006).
- **Base list**: the Source tracks after removing every song bound to a rule (ADR-0005), ordered by the base order mode (ADR-0004). Rules are applied on top of it.
- **Source playlist**: the input: an owned or collaborative playlist, or Liked Songs. Spotify-made and other users' playlists aren't readable.
- **Target playlist**: the private playlist the app writes, named `Rules: <name>`. Created once, overwritten on each regeneration. Played with shuffle off. Tracked by ID, so renaming in Spotify is safe; recreated on Save if deleted (ADR-0016).
- **Pin first**: rule placing its song at slot 1.
- **Insert every N**: rule placing its song at every N-th slot of the final playlist (ADR-0007).
- **Repeat N times**: rule playing its song N times back to back (ADR-0003).
- **Seed**: stored random seed for the base-order shuffle; same seed + same rules = same output. Reshuffle changes it.
- **Preview**: the rendering of the engine output before writing: a dot line, one dot per song, coloured by rule, with 'moved from #p' badges for shifted songs.
- **Archive**: hiding a Rule from the active library without deleting it; the alternative offered when a Rule in use can't be deleted.
- **Unavailable track**: a source item that comes back null, local or not playable. Skipped from the output; counted in the Preview (ADR-0011).
- **Regenerate**: recompute the Preview only; never writes to Spotify (ADR-0013).
- **Save to Spotify**: the explicit action that writes the engine output to the Target playlist.
