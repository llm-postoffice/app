package io.github.llm_postoffice.llmpost

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Die Fassung der App ist die der Web-App: versionName gleich js/version.js, versionCode dieselbe Zahl ohne Punkt. */
class FassungTest {
    private val fassung = Regex("""VERSION = '(\d{8}\.\d{2})'""")
        .find(File("../../js/version.js").readText())!!.groupValues[1]

    @Test fun nameIstDieFassungDerWebApp() = assertEquals(fassung, BuildConfig.VERSION_NAME)

    @Test fun codeIstDieFassungOhnePunkt() = assertEquals(fassung.replace(".", "").toInt(), BuildConfig.VERSION_CODE)

    @Test fun spaetereFassungHatGroesserenCode() {
        val code = { f: String -> f.replace(".", "").toInt() }
        assertTrue(code("20261118.01") > code("20261117.99"))
        assertTrue(code("20991231.99") < Int.MAX_VALUE)
    }
}
