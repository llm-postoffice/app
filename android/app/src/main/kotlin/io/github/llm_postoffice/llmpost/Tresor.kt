package io.github.llm_postoffice.llmpost

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Hält das Token verschlüsselt: AES-GCM mit 256 Bit, der Schlüssel bleibt im Android Keystore, IV (12 Byte) und
 * Geheimtext liegen in einer Datei unter noBackupFilesDir (keine Sicherung, kein Umzug auf ein anderes Gerät).
 * Nicht auf dem UI-Thread rufen.
 */
class Tresor(private val datei: File) {
    fun lies(): String? {
        if (!datei.exists()) return null
        return try {
            val roh = datei.readBytes()
            val c = Cipher.getInstance(VERFAHREN)
            c.init(Cipher.DECRYPT_MODE, schluessel(), GCMParameterSpec(128, roh, 0, IV))
            String(c.doFinal(roh, IV, roh.size - IV), Charsets.UTF_8)
        } catch (e: Exception) {
            // Schlüssel weg oder Datei kaputt: das Token ist verloren, die App fragt neu nach der Anmeldung
            datei.delete()
            null
        }
    }

    fun setze(token: String?) {
        if (token == null) {
            datei.delete()
            return
        }
        val c = Cipher.getInstance(VERFAHREN)
        c.init(Cipher.ENCRYPT_MODE, schluessel())
        val neu = File(datei.parentFile, datei.name + ".neu")
        neu.writeBytes(c.iv + c.doFinal(token.toByteArray(Charsets.UTF_8)))
        if (!neu.renameTo(datei)) {
            neu.delete()
            error("Token nicht gespeichert")
        }
    }

    private fun schluessel(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        val g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        g.init(
            KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return g.generateKey()
    }

    companion object {
        const val ALIAS = "llm-post-token"
        const val VERFAHREN = "AES/GCM/NoPadding"
        const val IV = 12
    }
}
