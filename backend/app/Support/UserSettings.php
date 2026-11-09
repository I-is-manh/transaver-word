<?php

namespace App\Support;

use App\Models\User;
use App\Models\UserSetting;

/**
 * Đọc/ghi cài đặt của người dùng. Lưu dạng {key: {value, source}}, đọc ra dạng phẳng,
 * khóa nào chưa có thì lấy mặc định.
 */
final class UserSettings
{
    /** @return array<string, mixed> */
    public static function values(User $user): array
    {
        $stored = self::record($user)->settings ?? [];
        $values = DefaultSettings::values();

        foreach ($values as $key => $default) {
            if (is_array($stored[$key] ?? null) && array_key_exists('value', $stored[$key])) {
                $values[$key] = $stored[$key]['value'];
            }
        }

        // Giữ đủ các khóa con của card_display khi bản lưu cũ thiếu khóa mới.
        $values['card_display'] = array_merge(DefaultSettings::values()['card_display'], (array) $values['card_display']);

        return $values;
    }

    public static function get(User $user, string $key): mixed
    {
        return self::values($user)[$key] ?? null;
    }

    /** @return array<string, string> nguồn của từng khóa */
    public static function sources(User $user): array
    {
        $stored = self::record($user)->settings ?? [];

        $keys = array_keys(DefaultSettings::values());

        return array_combine($keys, array_map(fn ($k) => $stored[$k]['source'] ?? 'default', $keys));
    }

    /**
     * Ghi nhiều khóa cùng nguồn. $onlyIfSourceIn: chỉ ghi khóa đang có nguồn thuộc danh sách này
     * (dùng cho onboarding: không đè cài đặt người dùng đã tự đặt).
     *
     * @param  array<string, mixed>  $values
     * @param  list<string>|null  $onlyIfSourceIn
     */
    public static function put(User $user, array $values, string $source, ?array $onlyIfSourceIn = null): void
    {
        $record = self::record($user);
        $settings = $record->settings ?? [];

        foreach ($values as $key => $value) {
            $current = $settings[$key]['source'] ?? 'default';
            if ($onlyIfSourceIn !== null && ! in_array($current, $onlyIfSourceIn, true)) {
                continue;
            }
            $settings[$key] = ['value' => $value, 'source' => $source];
        }

        $record->settings = $settings;
        $record->save();
        $user->setRelation('settings', $record);
    }

    private static function record(User $user): UserSetting
    {
        return $user->settings ?? $user->settings()->firstOrCreate([], [
            'settings' => DefaultSettings::make(),
            'schema_version' => DefaultSettings::SCHEMA_VERSION,
        ]);
    }
}
