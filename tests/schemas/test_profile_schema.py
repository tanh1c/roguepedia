from roguepedia.schemas.profile import EntityProfile, SourceInfo


def test_entity_profile_minimal():
    profile = EntityProfile(
        id="Q9036",
        name="Nikola Tesla",
        entity_type="human",
        source=SourceInfo(
            wikidata_id="Q9036",
            wikidata_url="https://www.wikidata.org/wiki/Q9036",
        ),
    )

    assert profile.id == "Q9036"
    assert profile.aliases == []
    assert profile.occupations == []
    assert profile.is_living_person_candidate is False
