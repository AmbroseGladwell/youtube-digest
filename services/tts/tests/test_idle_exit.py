import pytest

from fake_synthesiser import FakeSchedule
from overview_tts.idle_exit import IdleExit


def make_idle_exit(ready=True, clock=lambda: 0.0):
    stops = []
    schedule = FakeSchedule()
    idle_exit = IdleExit(15, lambda: stops.append(True), schedule, clock)
    if ready:
        idle_exit.start()
    return idle_exit, schedule, stops


def test_a_machine_that_boots_and_is_never_asked_stops_after_the_grace():
    _, schedule, stops = make_idle_exit()

    assert [timer.delay for timer in schedule.armed] == [15]
    schedule.armed[0].fire()

    assert stops == [True]


def test_a_request_holds_off_the_stop_until_it_finishes():
    idle_exit, schedule, stops = make_idle_exit()
    boot_timer = schedule.armed[0]

    with idle_exit.busy():
        assert schedule.armed == []
        boot_timer.fire()

    assert stops == []
    assert len(schedule.armed) == 1


def test_the_grace_restarts_after_each_request():
    idle_exit, schedule, stops = make_idle_exit()

    with idle_exit.busy():
        pass
    with idle_exit.busy():
        pass

    assert len(schedule.armed) == 1
    schedule.armed[0].fire()
    assert stops == [True]


def test_a_timer_that_fires_while_a_request_runs_does_not_stop_the_machine():
    idle_exit, schedule, stops = make_idle_exit()
    already_running = schedule.armed[0].action

    with idle_exit.busy():
        already_running()

    assert stops == []


def test_no_grace_runs_while_the_model_loads():
    _, schedule, stops = make_idle_exit(ready=False)

    assert schedule.armed == []
    assert stops == []


def test_the_grace_runs_its_full_length_from_readiness():
    idle_exit, schedule, stops = make_idle_exit(ready=False)

    idle_exit.start()

    assert [timer.delay for timer in schedule.armed] == [15]
    schedule.armed[0].fire()
    assert stops == [True]


def test_the_request_that_woke_the_machine_holds_it_open_across_readiness():
    idle_exit, schedule, stops = make_idle_exit(ready=False)

    with idle_exit.busy():
        idle_exit.start()
        assert schedule.armed == []

    assert [timer.delay for timer in schedule.armed] == [15]
    assert stops == []


def test_a_request_that_ends_before_readiness_does_not_start_the_grace():
    idle_exit, schedule, _ = make_idle_exit(ready=False)

    with idle_exit.busy():
        pass

    assert schedule.armed == []


def test_serving_time_counts_from_readiness_not_from_boot():
    now = [100.0]
    idle_exit, _, _ = make_idle_exit(ready=False, clock=lambda: now[0])

    assert idle_exit.serving_seconds() == 0.0
    now[0] = 113.9
    idle_exit.start()
    now[0] = 128.9

    assert idle_exit.serving_seconds() == pytest.approx(15.0)
