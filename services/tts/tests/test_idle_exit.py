from fake_synthesiser import FakeSchedule
from overview_tts.idle_exit import IdleExit


def make_idle_exit():
    stops = []
    schedule = FakeSchedule()
    idle_exit = IdleExit(15, lambda: stops.append(True), schedule)
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
