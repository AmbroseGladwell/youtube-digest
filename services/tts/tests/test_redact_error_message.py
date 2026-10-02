from overview_tts.redact_error_message import MAX_ERROR_MESSAGE_LENGTH, redact_error_message


def test_a_url_with_whatever_it_names_becomes_what_kind_of_thing_it_was():
    assert (
        redact_error_message("Failed to fetch https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42 from the panel")
        == "Failed to fetch <url> from the panel"
    )
    assert redact_error_message("Refused to load www.example.test/a/b") == "Refused to load <url>"


def test_an_email_address_is_removed():
    assert redact_error_message("No account for reader@example.com") == "No account for <email>"


def test_quoted_text_where_a_spoken_line_turns_up_is_removed():
    assert (
        redact_error_message('Unexpected token in "How I learned to stop worrying" at position 4')
        == "Unexpected token in <text> at position 4"
    )
    assert redact_error_message("Topic ‘Cooking for one’ not found") == "Topic <text> not found"
    assert redact_error_message("Value `my private note` is invalid") == "Value <text> is invalid"


def test_a_quoted_identifier_is_kept_because_it_names_code():
    assert redact_error_message("KeyError reading 'voice_pack'") == "KeyError reading 'voice_pack'"


def test_ids_are_removed_and_plain_words_and_small_numbers_kept():
    assert redact_error_message("No overview for dQw4w9WgXcQ") == "No overview for <id>"
    assert redact_error_message("Order 12345678 failed") == "Order <id> failed"
    assert redact_error_message("ffmpeg exited 255 without output") == "ffmpeg exited 255 without output"


def test_a_long_message_is_cut_short_and_whitespace_folded():
    redacted = redact_error_message("too\n\n  long " + "word " * 100)
    assert len(redacted) == MAX_ERROR_MESSAGE_LENGTH
    assert redacted.startswith("too long word")
    assert redacted.endswith("…")


def test_redacting_twice_changes_nothing():
    once = redact_error_message('Failed "Some title" at https://x.test/a for a@b.co with dQw4w9WgXcQ')
    assert redact_error_message(once) == once
