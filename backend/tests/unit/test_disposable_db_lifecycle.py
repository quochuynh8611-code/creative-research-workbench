"""
test_disposable_db_lifecycle.py — Unit tests (Mock-based) cho vòng đời Disposable DB Container.

Kiểm chứng các trường hợp:
1. Teardown lỗi khi không có lỗi trước đó -> raise tín hiệu teardown failure trực tiếp.
2. Helper qua injected exception (gen.throw): khi có injected exception và cleanup cũng thất bại -> chain qua __cause__.
3. start() lỗi trước khi có container: giữ nguyên lỗi gốc, không gọi pg.stop() hoặc tác động tài nguyên khác.
4. start() lỗi sau khi đã có container (_container is not None): thử cleanup đúng instance của container đó.
5. start() lỗi sau khi đã có container và cleanup cũng lỗi: cả lỗi gốc và lỗi cleanup đều có thông tin kiểm chứng (chain qua __cause__).

LƯU Ý: Module này là unit test thuần túy, sử dụng mock objects, không import/register DB fixtures và không khởi động Docker daemon thật.
"""
from __future__ import annotations

from unittest.mock import MagicMock
import pytest

from tests.integration.safe_disposable_db import disposable_pg_container_lifecycle


def test_cleanup_failure_without_prior_error_raises_teardown_error():
    """
    Kiểm chứng bằng mock: khi không có lỗi trước đó, nếu pg.stop() thất bại
    thì phải raise tín hiệu teardown failure trực tiếp (không bị silent pass).
    """
    mock_pg = MagicMock()
    mock_pg._container = MagicMock(id="mock_container_1234567890")
    mock_pg.get_exposed_port.return_value = 5432
    mock_pg.get_container_host_ip.return_value = "localhost"
    mock_pg.dbname = "test"
    mock_pg.stop.side_effect = RuntimeError("Teardown docker failure")

    mock_docker_client = MagicMock()
    raw_container = MagicMock()
    raw_container.status = "running"
    raw_container.ports = {"5432/tcp": [{"HostPort": "5432"}]}
    mock_docker_client.containers.get.return_value = raw_container

    gen = disposable_pg_container_lifecycle(
        pg_factory=lambda **kw: mock_pg,
        docker_client_factory=lambda: mock_docker_client,
    )
    # Setup thành công
    info = next(gen)
    assert info["container_id"] == "mock_container_1234567890"

    # Teardown: không có lỗi trước đó, stop() fail -> phải raise RuntimeError trực tiếp
    with pytest.raises(RuntimeError) as exc_info:
        next(gen, None)

    assert "Teardown docker failure" in str(exc_info.value)
    mock_pg.stop.assert_called_once()
    mock_docker_client.close.assert_called_once()


def test_injected_exception_during_yield_with_cleanup_failure_chains_errors():
    """
    Kiểm chứng helper qua injected exception (không claim mô phỏng đầy đủ pytest test-body failure):
    khi generator nhận injected exception qua gen.throw() và pg.stop() cũng thất bại,
    lỗi cleanup được chain qua __cause__ và lỗi gốc được bảo toàn nguyên vẹn.
    """
    mock_pg = MagicMock()
    mock_pg._container = MagicMock(id="mock_container_abcdef1234")
    mock_pg.get_exposed_port.return_value = 5432
    mock_pg.get_container_host_ip.return_value = "localhost"
    mock_pg.dbname = "test"
    mock_pg.stop.side_effect = RuntimeError("Cleanup error during teardown")

    mock_docker_client = MagicMock()
    raw_container = MagicMock()
    raw_container.status = "running"
    raw_container.ports = {"5432/tcp": [{"HostPort": "5432"}]}
    mock_docker_client.containers.get.return_value = raw_container

    gen = disposable_pg_container_lifecycle(
        pg_factory=lambda **kw: mock_pg,
        docker_client_factory=lambda: mock_docker_client,
    )
    # Setup thành công
    info = next(gen)
    assert info["container_id"] == "mock_container_abcdef1234"

    # Giả lập injected exception vào generator khi đang yield
    injected_err = ValueError("Injected exception during yield")
    with pytest.raises(RuntimeError) as exc_info:
        gen.throw(injected_err)

    # Khẳng định: stop_err được raise, nhưng __cause__ giữ nguyên lỗi gốc injected_err
    assert "Cleanup error during teardown" in str(exc_info.value)
    assert exc_info.value.__cause__ is injected_err
    mock_pg.stop.assert_called_once()
    mock_docker_client.close.assert_called_once()


def test_start_failure_before_container_created_preserves_error_without_cleanup():
    """
    start() lỗi trước khi có container (_container is None):
    giữ nguyên lỗi gốc, không gọi pg.stop() hoặc tác động tài nguyên khác.
    """
    mock_pg = MagicMock()
    mock_pg._container = None
    mock_pg.start.side_effect = RuntimeError("Failed before container creation: image pull failure")

    mock_docker_client = MagicMock()

    gen = disposable_pg_container_lifecycle(
        pg_factory=lambda **kw: mock_pg,
        docker_client_factory=lambda: mock_docker_client,
    )

    with pytest.raises(RuntimeError) as exc_info:
        next(gen)

    assert "Failed before container creation: image pull failure" in str(exc_info.value)
    # Không gọi stop() vì chưa có container nào được tạo
    mock_pg.stop.assert_not_called()
    mock_docker_client.assert_not_called()


def test_start_failure_after_container_created_attempts_cleanup_on_exact_instance():
    """
    start() lỗi sau khi đã có container (_container is not None):
    thử cleanup đúng instance của container đó.
    """
    mock_pg = MagicMock()
    mock_pg._container = MagicMock(id="mock_container_created_777777")
    mock_pg.start.side_effect = TimeoutError("Wait strategy timed out after container creation")

    mock_docker_client = MagicMock()

    gen = disposable_pg_container_lifecycle(
        pg_factory=lambda **kw: mock_pg,
        docker_client_factory=lambda: mock_docker_client,
    )

    with pytest.raises(TimeoutError) as exc_info:
        next(gen)

    assert "Wait strategy timed out after container creation" in str(exc_info.value)
    # Đã có container -> bắt buộc gọi stop() trên đúng instance
    mock_pg.stop.assert_called_once()


def test_start_failure_after_container_created_and_cleanup_also_fails_chains_errors():
    """
    start() lỗi sau khi đã có container và cleanup cũng lỗi:
    cả lỗi gốc và lỗi cleanup vẫn có thông tin kiểm chứng (chain qua __cause__).
    """
    mock_pg = MagicMock()
    mock_pg._container = MagicMock(id="mock_container_created_888888")
    mock_pg.start.side_effect = TimeoutError("Container start timed out")
    mock_pg.stop.side_effect = RuntimeError("Docker daemon failed while stopping container")

    mock_docker_client = MagicMock()

    gen = disposable_pg_container_lifecycle(
        pg_factory=lambda **kw: mock_pg,
        docker_client_factory=lambda: mock_docker_client,
    )

    with pytest.raises(RuntimeError) as exc_info:
        next(gen)

    assert "Docker daemon failed while stopping container" in str(exc_info.value)
    # Lỗi gốc TimeoutError được bảo toàn trong __cause__
    assert isinstance(exc_info.value.__cause__, TimeoutError)
    assert "Container start timed out" in str(exc_info.value.__cause__)
    mock_pg.stop.assert_called_once()
