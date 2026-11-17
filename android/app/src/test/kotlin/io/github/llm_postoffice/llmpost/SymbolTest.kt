package io.github.llm_postoffice.llmpost

import java.io.File
import org.junit.Assert.assertArrayEquals
import org.junit.Test

/** Das Symbol der Hülle ist eine Kopie des Symbols der Web-App. */
class SymbolTest {
    @Test fun vordergrundIstDasMaskierbareSymbol() = assertArrayEquals(
        File("../../symbole/maskierbar-512.png").readBytes(),
        File("src/main/res/drawable-nodpi/symbol_vorne.png").readBytes(),
    )
}
