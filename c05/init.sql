CREATE DATABASE IF NOT EXISTS imagesdb;
USE imagesdb;

CREATE TABLE IF NOT EXISTS users {
    id              INT AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(64) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL
}

CREATE TABLE IF NOT EXISTS jobs (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    job_id       VARCHAR(36) UNIQUE NOT NULL,
    user_id      INT NOT NULL,
    operation    VARCHAR(10) NOT NULL,
    mode         VARCHAR(10) NOT NULL,
    key_hex      VARCHAR(64) NOT NULL,
    iv_hex       VARCHAR(32),
    status       VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    download_url VARCHAR(255),
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
)

CREATE TABLE IF NOT EXISTS processed_images (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    job_id      VARCHAR(255) NOT NULL,
    operation   VARCHAR(10)  NOT NULL,
    mode        VARCHAR(10)  NOT NULL,
    iv          VARCHAR(32)  NULL,
    aes_key     VARCHAR(512) NOT NULL,
    image_data  LONGBLOB     NOT NULL,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);
