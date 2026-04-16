package eu.deic.ism;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class MpiLauncher {

    public byte[] launch(byte[] imageBytes, JobMessage job)
            throws IOException, InterruptedException {

        Path inputPath = Files.createTempFile("mpi_in_", ".bmp");
        Path outputPath = Files.createTempFile("mpi_out_", ".bmp");

        try {
            Files.write(inputPath, imageBytes);

            List<String> cmd = new ArrayList<>(Arrays.asList(
                "mpirun",
                "--allow-run-as-root",
                "-np", "2",
                "--host", "c03,c04",
                "/mpi/encrypt_decrypt",
                inputPath.toString(),
                outputPath.toString(),
                job.keyHex,
                job.operation,
                job.mode
            ));

            if (job.ivHex != null)
                cmd.add(job.ivHex);

            ProcessBuilder pb = new ProcessBuilder(cmd);
            pb.redirectErrorStream(true);
            Process process = pb.start();

            String output = new String(process.getInputStream().readAllBytes());
            int exitCode = process.waitFor();

            if (exitCode != 0) {
                System.err.println("MPI process failed:\n" + output);
                throw new IOException("MPI process exited with code " + exitCode);
            }

            return Files.readAllBytes(outputPath);

        } finally {
            Files.deleteIfExists(inputPath);
            Files.deleteIfExists(outputPath);
        }
    }
}
