#include <mpi.h>
#include <omp.h>
#include <openssl/aes.h>
#include <openssl/evp.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    char *in_bmp;
    char *out_bmp;
    char *hex_key;
    char *operation;
    char *mode;
    char *hex_iv; // optional
} input;

const char *INVALID_ARGS_MESSAGE =
    "Invalid args! Usage: ./encrypt_decrypt "
    "<input.bmp> <output.bmp> <key_hex=32B> "
    "<encrypt|decrypt> <ECB|CBC|CFB|OFB|CTR> [iv_hex=16B]\n";

unsigned char *hex_to_bytes(unsigned char *hex) {
    if (hex == NULL) {
        return NULL;
    }

    if (strlen(hex) % 2 != 0) {
        return NULL;
    }

    unsigned char *bytes = (unsigned char *)malloc(strlen(hex) / 2);
    if (!bytes) {
        return NULL;
    }

    for (int i = 0; i < strlen(hex) / 2; i++) {
        sscanf(hex + i * 2, "%2hhx", &bytes[i]);
    }

    return bytes;
}

input parse_args(int argc, char **argv) {
    input in;
    char *temp = NULL;
    char *buff = NULL;

    if (argc < 6) {
        fprintf(stderr, INVALID_ARGS_MESSAGE);
        exit(1);
    }

    temp = argv[1];
    if (temp == NULL || strcmp(".bmp", temp + strlen(temp) - 4)) {
        fprintf(stderr, INVALID_ARGS_MESSAGE);
        exit(1);
    }
    buff = (char *)malloc(strlen(temp) + 1);
    strcpy(buff, temp);
    in.in_bmp = buff;

    temp = argv[2];
    if (temp == NULL || strcmp(".bmp", temp + strlen(temp) - 4)) {
        fprintf(stderr, INVALID_ARGS_MESSAGE);
        exit(1);
    }
    buff = (char *)malloc(strlen(temp) + 1);
    strcpy(buff, temp);
    in.out_bmp = buff;

    temp = argv[3];
    if (temp == NULL || strlen(temp) != 64) {
        fprintf(stderr, INVALID_ARGS_MESSAGE);
        exit(1);
    }
    buff = (char *)malloc(strlen(temp) + 1);
    strcpy(buff, temp);
    in.hex_key = buff;

    temp = argv[4];
    if (temp == NULL || (strcmp("encrypt", temp) && strcmp("decrypt", temp))) {
        fprintf(stderr, INVALID_ARGS_MESSAGE);
        exit(1);
    }
    buff = (char *)malloc(strlen(temp) + 1);
    strcpy(buff, temp);
    in.operation = buff;

    temp = argv[5];
    if (temp == NULL ||
        (strcmp("ECB", temp) && strcmp("CBC", temp) && strcmp("CFB", temp) &&
         strcmp("OFB", temp) && strcmp("CTR", temp))) {
        fprintf(stderr, INVALID_ARGS_MESSAGE);
        exit(1);
    }
    buff = (char *)malloc(strlen(temp) + 1);
    strcpy(buff, temp);
    in.mode = buff;

    if (argc < 7 && strcmp("ECB", in.mode)) {
        fprintf(stderr, INVALID_ARGS_MESSAGE);
        exit(1);
    }

    if (argc == 7) {
        temp = argv[6];

        if (temp == NULL || strlen(temp) != AES_BLOCK_SIZE * 2) {
            fprintf(stderr, INVALID_ARGS_MESSAGE);
            exit(1);
        }
        buff = (char *)malloc(strlen(temp) + 1);
        strcpy(buff, temp);
        in.hex_iv = buff;
    } else if (!strcmp("ECB", in.mode)) {
        in.hex_iv = NULL;
    } else {
        fprintf(stderr, INVALID_ARGS_MESSAGE);
        exit(1);
    }

    return in;
}

unsigned char *read_bmp(const char *path, long *file_size,
                        uint32_t *pixel_offset) {
    FILE *in = fopen(path, "rb");
    if (in == NULL) {
        MPI_Abort(MPI_COMM_WORLD, 1);
    }

    fseek(in, 0, SEEK_END);
    *file_size = ftell(in);
    fseek(in, 0, SEEK_SET);

    unsigned char *data = (unsigned char *)malloc(*file_size);
    if (!data) {
        fclose(in);
        MPI_Abort(MPI_COMM_WORLD, 1);
    }

    fread(data, sizeof(char), *file_size, in);
    fclose(in);

    memcpy(pixel_offset, data + 10, 4);

    return data;
}

static const EVP_CIPHER *get_cipher(const char *mode) {
    if (!strcmp(mode, "ECB"))
        return EVP_aes_256_ecb();
    if (!strcmp(mode, "CBC"))
        return EVP_aes_256_cbc();
    if (!strcmp(mode, "CFB"))
        return EVP_aes_256_cfb();
    if (!strcmp(mode, "OFB"))
        return EVP_aes_256_ofb();
    if (!strcmp(mode, "CTR"))
        return EVP_aes_256_ctr();
    return NULL;
}

static void ctr_add(const unsigned char *iv, unsigned char *out, long n) {
    memcpy(out, iv, AES_BLOCK_SIZE);
    for (int i = AES_BLOCK_SIZE - 1; i >= 0 && n > 0; i--) {
        n += out[i];
        out[i] = (unsigned char)(n & 0xFF);
        n >>= 8;
    }
}

void process_chunk(unsigned char *chunk, long chunk_size,
                   const unsigned char *key, const unsigned char *iv,
                   const char *operation, const char *mode, long block_offset) {
    int encrypt = !strcmp(operation, "encrypt");
    int num_blocks = (int)(chunk_size / AES_BLOCK_SIZE);
    const EVP_CIPHER *cipher = get_cipher(mode);

    int parallel = !strcmp(mode, "ECB") || !strcmp(mode, "CTR") ||
                   ((!strcmp(mode, "CBC") || !strcmp(mode, "CFB")) && !encrypt);

    if (parallel) {
        unsigned char *orig = NULL;
        if (!encrypt && (!strcmp(mode, "CBC") || !strcmp(mode, "CFB"))) {
            orig = malloc(chunk_size);
            if (!orig)
                MPI_Abort(MPI_COMM_WORLD, 1);
            memcpy(orig, chunk, chunk_size);
        }

#pragma omp parallel for
        for (int i = 0; i < num_blocks; i++) {
            unsigned char block_iv[AES_BLOCK_SIZE];
            const unsigned char *this_iv = NULL;

            if (!strcmp(mode, "CBC") || !strcmp(mode, "CFB")) {
                if (i == 0)
                    memcpy(block_iv, iv, AES_BLOCK_SIZE);
                else
                    memcpy(block_iv, orig + (i - 1) * AES_BLOCK_SIZE,
                           AES_BLOCK_SIZE);
                this_iv = block_iv;
            } else if (!strcmp(mode, "CTR")) {
                ctr_add(iv, block_iv, block_offset + i);
                this_iv = block_iv;
            }

            unsigned char out_block[AES_BLOCK_SIZE];
            int outlen;
            EVP_CIPHER_CTX *ctx = EVP_CIPHER_CTX_new();

            if (encrypt)
                EVP_EncryptInit_ex(ctx, cipher, NULL, key, this_iv);
            else
                EVP_DecryptInit_ex(ctx, cipher, NULL, key, this_iv);

            EVP_CIPHER_CTX_set_padding(ctx, 0);

            if (encrypt)
                EVP_EncryptUpdate(ctx, out_block, &outlen,
                                  chunk + i * AES_BLOCK_SIZE, AES_BLOCK_SIZE);
            else
                EVP_DecryptUpdate(ctx, out_block, &outlen,
                                  chunk + i * AES_BLOCK_SIZE, AES_BLOCK_SIZE);

            memcpy(chunk + i * AES_BLOCK_SIZE, out_block, AES_BLOCK_SIZE);
            EVP_CIPHER_CTX_free(ctx);
        }

        free(orig);
    } else {
        EVP_CIPHER_CTX *ctx = EVP_CIPHER_CTX_new();
        if (!ctx)
            MPI_Abort(MPI_COMM_WORLD, 1);

        if (encrypt)
            EVP_EncryptInit_ex(ctx, cipher, NULL, key, iv);
        else
            EVP_DecryptInit_ex(ctx, cipher, NULL, key, iv);

        EVP_CIPHER_CTX_set_padding(ctx, 0);

        unsigned char *out = malloc(chunk_size);
        if (!out) {
            EVP_CIPHER_CTX_free(ctx);
            MPI_Abort(MPI_COMM_WORLD, 1);
        }

        int outlen;
        if (encrypt)
            EVP_EncryptUpdate(ctx, out, &outlen, chunk, (int)chunk_size);
        else
            EVP_DecryptUpdate(ctx, out, &outlen, chunk, (int)chunk_size);

        memcpy(chunk, out, chunk_size);
        free(out);
        EVP_CIPHER_CTX_free(ctx);
    }
}

int main(int argc, char *argv[]) {
    if (MPI_Init(&argc, &argv) != MPI_SUCCESS) {
        fprintf(stderr, "MPI_Init failed!\n");
        exit(1);
    }

    int rank, size;
    long padded_pixel_size;
    long bmp_size;
    unsigned char *bmp = NULL;
    uint32_t pixel_offset;
    input in = parse_args(argc, argv);

    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    MPI_Comm_size(MPI_COMM_WORLD, &size);

    if (rank == 0) {
        bmp = read_bmp(in.in_bmp, &bmp_size, &pixel_offset);

        int alignment = size * AES_BLOCK_SIZE;
        int pixel_size = bmp_size - pixel_offset;
        int padding_size = (alignment - (pixel_size % alignment)) % alignment;
        padded_pixel_size = pixel_size + padding_size;

        if (padding_size > 0) {
            unsigned char *temp = realloc(bmp, bmp_size + padding_size);
            if (temp == NULL) {
                free(bmp);
                MPI_Abort(MPI_COMM_WORLD, 1);
            }
            bmp = temp;
            memset(bmp + bmp_size, 0, padding_size);
        }
    }

    unsigned char *key = hex_to_bytes(in.hex_key);
    unsigned char *iv = hex_to_bytes(in.hex_iv);

    MPI_Bcast(&padded_pixel_size, 1, MPI_LONG, 0, MPI_COMM_WORLD);
    MPI_Bcast(&pixel_offset, 1, MPI_UINT32_T, 0, MPI_COMM_WORLD);

    long chunk_size = padded_pixel_size / size;
    unsigned char *chunk = (unsigned char *)malloc(chunk_size);
    if (!chunk)
        MPI_Abort(MPI_COMM_WORLD, 1);

    MPI_Scatter(rank == 0 ? bmp + pixel_offset : NULL, chunk_size, MPI_BYTE,
                chunk, chunk_size, MPI_BYTE, 0, MPI_COMM_WORLD);

    long block_offset = (long)rank * (chunk_size / AES_BLOCK_SIZE);

    const unsigned char *chunk_iv = iv;
    unsigned char boundary_iv[AES_BLOCK_SIZE];
    if ((!strcmp(in.mode, "CBC") || !strcmp(in.mode, "CFB")) &&
        !strcmp(in.operation, "decrypt")) {
        MPI_Sendrecv(chunk + chunk_size - AES_BLOCK_SIZE, AES_BLOCK_SIZE,
                     MPI_BYTE, rank < size - 1 ? rank + 1 : MPI_PROC_NULL, 0,
                     boundary_iv, AES_BLOCK_SIZE, MPI_BYTE,
                     rank > 0 ? rank - 1 : MPI_PROC_NULL, 0, MPI_COMM_WORLD,
                     MPI_STATUS_IGNORE);
        if (rank > 0)
            chunk_iv = boundary_iv;
    }

    process_chunk(chunk, chunk_size, key, chunk_iv, in.operation, in.mode,
                  block_offset);

    MPI_Gather(chunk, chunk_size, MPI_BYTE,
               rank == 0 ? bmp + pixel_offset : NULL, chunk_size, MPI_BYTE, 0,
               MPI_COMM_WORLD);

    if (rank == 0) {
        FILE *out = fopen(in.out_bmp, "wb");
        if (!out)
            MPI_Abort(MPI_COMM_WORLD, 1);
        fwrite(bmp, 1, bmp_size, out);
        fclose(out);
        free(bmp);
    }

    free(chunk);
    free(key);
    free(iv);

    MPI_Finalize();
    return 0;
}
