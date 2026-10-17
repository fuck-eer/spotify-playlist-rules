package com.rulemix.app.data

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

interface Connectivity {
    val online: StateFlow<Boolean>
}

class FakeConnectivity(initial: Boolean = true) : Connectivity {
    override val online = MutableStateFlow(initial)
}

class AndroidConnectivity(context: Context) : Connectivity {
    private val cm = context.getSystemService(ConnectivityManager::class.java)
    private val state = MutableStateFlow(current())
    override val online: StateFlow<Boolean> = state

    init {
        cm?.registerDefaultNetworkCallback(object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                state.value = true
            }
            override fun onLost(network: Network) {
                state.value = current()
            }
        })
    }

    private fun current(): Boolean {
        val caps = cm?.getNetworkCapabilities(cm.activeNetwork) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }
}
