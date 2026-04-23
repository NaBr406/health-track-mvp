package com.healthtrack.mvp.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Daily step totals synced from the device health provider.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(
        name = "step_records",
        uniqueConstraints = @UniqueConstraint(name = "uk_step_records_user_date", columnNames = {"user_id", "recorded_on"})
)
public class StepRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private LocalDate recordedOn;

    @Column(nullable = false)
    private Integer steps;

    @Column(length = 60)
    private String source;

    @Column(length = 120)
    private String sourceDevice;

    @Column(length = 80)
    private String sourceTimeZone;

    private LocalDateTime syncedAt;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (recordedOn == null) {
            recordedOn = LocalDate.now();
        }
        if (steps == null) {
            steps = 0;
        }
        if (syncedAt == null) {
            syncedAt = now;
        }
    }

    @PreUpdate
    public void onUpdate() {
        updatedAt = LocalDateTime.now();
        if (syncedAt == null) {
            syncedAt = updatedAt;
        }
    }
}
