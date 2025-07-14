package com.playground

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import android.util.Log
import android.app.AlertDialog
import android.content.Context

class MainActivity : ReactActivity() {

  private var rnDevtools: RnDevtools? = null

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "Playground"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: android.os.Bundle?) {
    Log.d("MainActivity", "onCreate called")
    super.onCreate(savedInstanceState)
    
    // Setup RnDevtools
    setupRnDevtools()
  }
  
  override fun onStart() {
    Log.d("MainActivity", "onStart called")
    super.onStart()
  }
  
  override fun onResume() {
    Log.d("MainActivity", "onResume called")
    super.onResume()
    
    // Try setting up RnDevtools here as well
    if (rnDevtools == null) {
      Log.d("MainActivity", "Setting up RnDevtools in onResume")
      setupRnDevtools()
    }
  }
  
  private fun setupRnDevtools() {
    Log.d("MainActivity", "setupRnDevtools called")
    
    // Create RnDevtools instance with WebSocket URL and plugin ID
    rnDevtools = RnDevtools(
      url = "ws://localhost:8888",
      pluginId = "native-world"
    )
    
    // Add message listener
    rnDevtools?.addMessageListener(object : RnDevtools.DevToolsMessageListener {
      override fun onMessageReceived(message: RnDevtools.DevToolsPluginMessage) {
        Log.d("MainActivity", "Received message: ${message.type} - ${message.payload}")
        
        // Show system alert with the payload
        showMessageAlert(message)
      }
    })
    
    // Connect to WebSocket
    rnDevtools?.connect() 
    Log.d("MainActivity", "RnDevtools will try to connect soon")
  }
  
  private fun showMessageAlert(message: RnDevtools.DevToolsPluginMessage) {
    runOnUiThread {
      AlertDialog.Builder(this)
        .setTitle("DevTools Message: ${message.type}")
        .setMessage("Payload: ${message.payload}")
        .setPositiveButton("OK") { dialog, _ ->
          dialog.dismiss()
        }
        .show()
    }
  }
  
  override fun onDestroy() {
    Log.d("MainActivity", "onDestroy called")
    super.onDestroy()
    // Clean up RnDevtools resources
    rnDevtools?.close()
  }
}
