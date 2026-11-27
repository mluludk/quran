from etl.normalize import normalize_arabic_search


def test_normalize_strips_diacritics_and_normalizes_alif() -> None:
    assert normalize_arabic_search("بِسۡمِ") == "بسم"
    assert normalize_arabic_search("ٱلۡحَمۡدُ") == "الحمد"
    assert normalize_arabic_search("إِيَّاكَ") == "اياك"
    assert normalize_arabic_search("ٱلصِّرَٰطَ") == "الصرط"
    assert normalize_arabic_search("ٱلرَّحۡمَٰنِ") == "الرحمن"
    assert normalize_arabic_search("رَحْمَةً") == "رحمه"
    assert normalize_arabic_search("هُدًى") == "هدي"
