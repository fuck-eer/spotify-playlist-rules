package com.rulemix.app.domain

import com.rulemix.app.data.MixState
import com.rulemix.engine.BuildInput
import com.rulemix.engine.BuildResult
import com.rulemix.engine.MixRuleInput
import com.rulemix.engine.build

/** Builds the graph on-device from GET /state (same mapping as web `buildFromState`). */
fun buildFromState(s: MixState): BuildResult = build(
    BuildInput(
        source = s.source,
        rules = s.rules.map { MixRuleInput(it.id, it.kind, it.trackUri, it.n, it.removedPlays, it.deletedCopies) },
        keepSourceOrder = s.mix.keepSourceOrder,
        seed = s.mix.shuffleSeed,
        manualOrder = s.arrangement.manualOrder,
        bench = s.arrangement.bench,
    ),
)
