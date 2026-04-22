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
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 饮食记录实体，既可以手动录入，也可以从对话里抽取。
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "diet_records")
public class DietRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private LocalDate recordedOn;

    @Column(nullable = false, length = 40)
    private String mealType;

    @Column(nullable = false, length = 120)
    private String foodName;

    @Column(nullable = false)
    private Integer calories;

    private BigDecimal proteinGrams;

    private BigDecimal carbsGrams;

    private BigDecimal fatGrams;

    @Column(length = 1000)
    private String note;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void onCreate() {
        createdAt = LocalDateTime.now();
        if (recordedOn == null) {
            recordedOn = LocalDate.now();
        }
    }
}

