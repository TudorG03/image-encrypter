CREATE DATABASE IF NOT EXISTS imagesdb;
USE imagesdb;

CREATE TABLE IF NOT EXISTS processed_images (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    job_id      VARCHAR(255) NOT NULL,
    operation   VARCHAR(10)  NOT NULL,
    mode        VARCHAR(10)  NOT NULL,
    aes_key     VARCHAR(512) NOT NULL,
    image_data  LONGBLOB     NOT NULL,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);
