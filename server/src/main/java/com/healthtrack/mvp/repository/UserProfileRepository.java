package com.healthtrack.mvp.repository;

import com.healthtrack.mvp.domain.UserProfile;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 用户健康档案的 JPA 访问层。
 */
public interface UserProfileRepository extends JpaRepository<UserProfile, Long> {

    Optional<UserProfile> findByUserId(Long userId);
}

