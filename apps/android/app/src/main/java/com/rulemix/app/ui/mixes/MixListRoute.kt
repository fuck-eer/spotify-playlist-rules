package com.rulemix.app.ui.mixes

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import com.rulemix.app.AppContainer
import com.rulemix.app.data.ApiException
import com.rulemix.app.data.CachedResult
import com.rulemix.app.data.Mix
import com.rulemix.app.data.SourceOption
import kotlinx.coroutines.launch

@Composable
fun MixListRoute(container: AppContainer, onOpen: (String) -> Unit) {
    val online by container.connectivity.online.collectAsState()
    var result by remember { mutableStateOf<CachedResult<List<Mix>>?>(null) }
    var tick by remember { mutableIntStateOf(0) }
    var picking by remember { mutableStateOf(false) }
    var sources by remember { mutableStateOf<List<SourceOption>?>(null) }
    var pickError by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(tick, online) { container.mixes.mixes().collect { result = it } }
    MixListScreen(
        result = result,
        online = online,
        onOpen = { onOpen(it.id) },
        onNewMix = {
            picking = true
            sources = null
            pickError = null
            scope.launch {
                try {
                    sources = container.mixes.sources().sources
                } catch (e: ApiException) {
                    pickError = e.message
                    sources = emptyList()
                }
            }
        },
        onSignOut = { scope.launch { container.auth.signOut(); container.cache.clear() } },
    )
    if (picking) {
        SourcePickerSheet(
            sources = sources,
            error = pickError,
            onPick = { name, s ->
                scope.launch {
                    try {
                        val mix = container.mixes.createMix(name, s)
                        picking = false
                        tick++
                        onOpen(mix.id)
                    } catch (e: ApiException) {
                        pickError = e.message
                    }
                }
            },
            onDismiss = { picking = false },
        )
    }
}
