package io.github.llm_postoffice.llmpost

import android.content.ContentResolver
import android.net.Uri
import android.provider.OpenableColumns
import java.io.InputStream

/** Die Dateien hinter content://-Adressen über den ContentResolver; die Logik darüber steht in Teilen.kt. */
class InhaltsQuelle(private val aufloeser: ContentResolver) : Quelle {
    private fun abfrage(adresse: String, spalte: String): Pair<Int, android.database.Cursor>? {
        val c = try { aufloeser.query(Uri.parse(adresse), arrayOf(spalte), null, null, null) } catch (_: Exception) { null } ?: return null
        val i = c.getColumnIndex(spalte)
        if (i < 0 || !c.moveToFirst()) { c.close(); return null }
        return i to c
    }

    override fun name(adresse: String): String? = abfrage(adresse, OpenableColumns.DISPLAY_NAME)?.let { (i, c) ->
        c.use { if (it.isNull(i)) null else it.getString(i) }
    }

    override fun groesse(adresse: String): Long? = abfrage(adresse, OpenableColumns.SIZE)?.let { (i, c) ->
        c.use { if (it.isNull(i)) null else it.getLong(i) }
    }

    override fun typ(adresse: String): String? = try { aufloeser.getType(Uri.parse(adresse)) } catch (_: Exception) { null }

    override fun oeffne(adresse: String): InputStream? = try { aufloeser.openInputStream(Uri.parse(adresse)) } catch (_: Exception) { null }
}
