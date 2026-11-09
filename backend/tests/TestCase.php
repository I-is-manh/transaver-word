<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Http;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Test không bao giờ gọi mạng thật: request HTTP nào chưa Http::fake sẽ báo lỗi.
        Http::preventStrayRequests();
    }
}
