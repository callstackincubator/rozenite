package com.playground

import android.util.Log
import okhttp3.*
import kotlinx.coroutines.*
import org.json.JSONObject
import org.json.JSONException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.TimeUnit

/**
 * RnDevtools class for establishing WebSocket connections and handling DevTools plugin messages
 */
class RnDevtools(
    private val url: String,
    private val pluginId: String
) {
    init {
        Log.d(TAG, "RnDevtools constructor called with url: $url, pluginId: $pluginId")
    }
    
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()
    
    private val listeners = CopyOnWriteArrayList<DevToolsMessageListener>()
    private var webSocket: WebSocket? = null
    private var isConnected = false
    
    /**
     * Interface for listening to DevTools plugin messages
     */
    interface DevToolsMessageListener {
        fun onMessageReceived(message: DevToolsPluginMessage)
    }
    
    /**
     * Data class representing a DevTools plugin message
     */
    data class DevToolsPluginMessage(
        val pluginId: String,
        val type: String,
        val payload: Any
    )
    
    /**
     * Connect to the WebSocket server
     */
    fun connect() {
        Log.d(TAG, "connect() called")
        if (isConnected) {
            Log.w(TAG, "Already connected")
            return
        }
        
        Log.d(TAG, "Attempting to connect to: $url")
        val request = Request.Builder()
            .url(url)
            .build()
        
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.d(TAG, "WebSocket connection opened")
                isConnected = true
            }
            
            override fun onMessage(webSocket: WebSocket, text: String) {
                Log.d(TAG, "Received text message: $text")
                handleMessage(text)
            }
            
            override fun onMessage(webSocket: WebSocket, bytes: okio.ByteString) {
                Log.d(TAG, "Received binary message of ${bytes.size} bytes")
                try {
                    // Try to convert binary message to text
                    val text = bytes.utf8()
                    Log.d(TAG, "Converted binary to text: $text")
                    handleMessage(text)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to convert binary message to text", e)
                    // Handle binary message as base64 or other format if needed
                    val base64 = bytes.base64()
                    Log.d(TAG, "Binary message as base64: $base64")
                    // You could create a special message type for binary data
                    handleBinaryMessage(base64)
                }
            }
            
            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "WebSocket connection closed: $code - $reason")
                isConnected = false
            }
            
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "WebSocket connection failed", t)
                isConnected = false
            }
        })
    }
    
    /**
     * Disconnect from the WebSocket server
     */
    fun disconnect() {
        webSocket?.close(1000, "Normal closure")
        webSocket = null
        isConnected = false
    }
    
    /**
     * Add a listener for DevTools plugin messages
     */
    fun addMessageListener(listener: DevToolsMessageListener) {
        listeners.add(listener)
    }
    
    /**
     * Remove a listener for DevTools plugin messages
     */
    fun removeMessageListener(listener: DevToolsMessageListener) {
        listeners.remove(listener)
    }
    
    /**
     * Send a message to the WebSocket server
     */
    fun sendMessage(type: String, payload: Any) {
        if (!isConnected) {
            Log.w(TAG, "Cannot send message: not connected")
            return
        }
        
        try {
            val message = JSONObject().apply {
                put("pluginId", pluginId)
                put("type", type)
                put("payload", payload)
            }
            
            webSocket?.send(message.toString())
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send message", e)
        }
    }
    
    /**
     * Send a binary message to the WebSocket server
     */
    fun sendBinaryMessage(type: String, payload: ByteArray) {
        if (!isConnected) {
            Log.w(TAG, "Cannot send binary message: not connected")
            return
        }
        
        try {
            val message = JSONObject().apply {
                put("pluginId", pluginId)
                put("type", type)
                put("payload", android.util.Base64.encodeToString(payload, android.util.Base64.DEFAULT))
            }
            
            webSocket?.send(message.toString())
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send binary message", e)
        }
    }
    
    /**
     * Handle incoming WebSocket messages
     */
    private fun handleMessage(message: String) {
        try {
            val jsonObject = JSONObject(message)
            val messagePluginId = jsonObject.getString("pluginId")
            
            // Only process messages with matching pluginId
            if (messagePluginId == pluginId) {
                val type = jsonObject.getString("type")
                val payload = jsonObject.get("payload")
                
                val devToolsMessage = DevToolsPluginMessage(
                    pluginId = messagePluginId,
                    type = type,
                    payload = payload
                )
                
                // Notify all listeners on main thread
                CoroutineScope(Dispatchers.Main).launch {
                    listeners.forEach { listener ->
                        try {
                            listener.onMessageReceived(devToolsMessage)
                        } catch (e: Exception) {
                            Log.e(TAG, "Error in message listener", e)
                        }
                    }
                }
            }
        } catch (e: JSONException) {
            Log.e(TAG, "Failed to parse message: $message", e)
        } catch (e: Exception) {
            Log.e(TAG, "Error handling message", e)
        }
    }
    
    /**
     * Handle binary messages (if needed)
     */
    private fun handleBinaryMessage(base64Message: String) {
        // This is a placeholder for handling binary messages.
        // In a real application, you might want to parse the base64 string
        // into a specific binary data structure or pass it as is.
        Log.d(TAG, "Received binary message as base64: $base64Message")
        // Example: If you need to send it back as a text message, you can do:
        // sendMessage("binary_data", base64Message)
    }
    
    /**
     * Check if currently connected
     */
    fun isConnected(): Boolean = isConnected
    
    /**
     * Clean up resources
     */
    fun close() {
        disconnect()
        client.dispatcher.executorService.shutdown()
        client.connectionPool.evictAll()
    }
    
    companion object {
        private const val TAG = "RnDevtools"
    }
} 